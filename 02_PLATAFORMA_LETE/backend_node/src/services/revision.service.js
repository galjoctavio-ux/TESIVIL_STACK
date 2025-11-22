import { supabaseAdmin } from './supabaseClient.js';
import { Buffer } from 'buffer';
import axios from 'axios';
import {
  calcularConsumoEquipos,
  detectarFugas,
  verificarSolar,
  generarDiagnosticosAutomaticos
} from './calculos.service.js';
import { enviarReportePorEmail } from './email.service.js';
import { generarPDF } from './pdf.service.js';

export const processRevision = async (payload, tecnico) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData"');
  }

  // 1. SANITIZACIÓN
  const datosDeTrabajo = { ...revisionData };
  datosDeTrabajo.fuga_total = parseFloat(datosDeTrabajo.fuga_total) || 0;
  datosDeTrabajo.voltaje_medido = parseFloat(datosDeTrabajo.voltaje_medido) || 0;

  if (datosDeTrabajo.voltaje_fn) {
    const vFn = parseFloat(datosDeTrabajo.voltaje_fn) || 0;
    if (datosDeTrabajo.voltaje_medido === 0) datosDeTrabajo.voltaje_medido = vFn;
  }
  if (datosDeTrabajo.caso_id) datosDeTrabajo.caso_id = Number(datosDeTrabajo.caso_id);

  // Sanitización Equipos
  const equiposSanitizados = equiposData.map(eq => ({
    nombre_equipo: eq.nombre_equipo,
    nombre_personalizado: eq.nombre_personalizado || '',
    estado_equipo: eq.estado_equipo,
    unidad_tiempo: eq.unidad_tiempo || 'Horas/Día',
    tiempo_uso: parseFloat(eq.horas_uso || eq.tiempo_uso) || 0,
    amperaje_medido: parseFloat(eq.amperaje_medido) || 0,
    cantidad: parseFloat(eq.cantidad) || 1
  }));

  console.log(`Procesando revisión Caso ${datosDeTrabajo.caso_id}, Téc: ${tecnico.email}`);
  let casoData;
  let pdfUrl = null;
  let firmaUrl = null;

  try {
    // 2. CÁLCULOS
    const voltajeCalculo = datosDeTrabajo.voltaje_medido > 0 ? datosDeTrabajo.voltaje_medido : 127;
    const equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltajeCalculo);
    const diagnosticoFuga = detectarFugas(datosDeTrabajo);
    const diagnosticoSolar = verificarSolar(datosDeTrabajo);
    const diagnosticos = generarDiagnosticosAutomaticos(datosDeTrabajo, equiposCalculados, diagnosticoFuga, diagnosticoSolar);

    // 3. GUARDADO DB (Supabase)
    const datosParaInsertar = { ...datosDeTrabajo };
    delete datosParaInsertar.voltaje_fn;
    delete datosParaInsertar.fuga_total;
    delete datosParaInsertar.amperaje_medido;

    datosParaInsertar.tecnico_id = tecnico.id;
    datosParaInsertar.diagnosticos_automaticos = diagnosticos;

    const { data: revisionResult, error: revisionError } = await supabaseAdmin
      .from('revisiones')
      .insert(datosParaInsertar)
      .select()
      .single();

    if (revisionError) throw revisionError;
    const newRevisionId = revisionResult.id;

    // Guardar Equipos
    let equiposProcesados = 0;
    if (equiposCalculados.length > 0) {
      const equiposInsert = equiposCalculados.map(eq => ({
        revision_id: newRevisionId,
        nombre_equipo: eq.nombre_equipo,
        nombre_personalizado: eq.nombre_personalizado,
        amperaje_medido: eq.amperaje_medido,
        tiempo_uso: eq.tiempo_uso,
        unidad_tiempo: eq.unidad_tiempo,
        estado_equipo: eq.estado_equipo,
        kwh_bimestre_calculado: eq.kwh_bimestre_calculado
      }));

      const { error: eqErr } = await supabaseAdmin.from('equipos_revisados').insert(equiposInsert);
      if (eqErr) throw eqErr;
      equiposProcesados = equiposInsert.length;
    }

    // Actualizar Caso y obtener datos cliente
    const { data: casoUpdated, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', datosDeTrabajo.caso_id)
      .select('cliente_nombre, cliente_direccion')
      .single();

    if (casoError) console.warn(`Error caso ${datosDeTrabajo.caso_id}:`, casoError.message);
    casoData = casoUpdated;

    // 4. FIRMA (Subir a Storage)
    if (firmaBase64) {
      const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filePath = `firmas/revision-${newRevisionId}.png`;

        const { error: upErr } = await supabaseAdmin.storage.from('reportes').upload(filePath, data, { contentType });
        if (!upErr) {
          const { data: urlData } = supabaseAdmin.storage.from('reportes').getPublicUrl(filePath);
          firmaUrl = urlData.publicUrl;
          await supabaseAdmin.from('revisiones').update({ firma_url: firmaUrl }).eq('id', newRevisionId);
        }
      }
    }

    // 5. GENERAR PDF (Local Node.js)
    const datosParaPdf = {
      header: {
        id: newRevisionId,
        fecha_revision: new Date().toISOString(),
        cliente_nombre: casoData?.cliente_nombre || 'Cliente',
        cliente_direccion: casoData?.cliente_direccion || '',
        cliente_email: revisionResult.cliente_email || '',
        tecnico_nombre: tecnico.email
      },
      mediciones: {
        tipo_servicio: revisionResult.tipo_servicio,
        sello_cfe: revisionResult.sello_cfe,
        tornillos_flojos: revisionResult.tornillos_flojos,
        capacidad_vs_calibre: revisionResult.capacidad_vs_calibre,
        edad_instalacion: revisionResult.edad_instalacion,
        observaciones_cc: revisionResult.observaciones_cc,
        voltaje_medido: revisionResult.voltaje_medido,
        corriente_red_f1: revisionResult.corriente_red_f1,
        corriente_red_f2: revisionResult.corriente_red_f2,
        corriente_red_f3: revisionResult.corriente_red_f3,
        corriente_fuga_f1: revisionResult.corriente_fuga_f1,
        cantidad_paneles: revisionResult.cantidad_paneles,
        watts_por_panel: revisionResult.watts_por_panel,
        paneles_antiguedad_anos: revisionResult.paneles_antiguedad_anos
      },
      equipos: equiposCalculados.map(eq => ({
        nombre_equipo: eq.nombre_equipo,
        ubicacion: eq.nombre_personalizado,
        amperaje: eq.amperaje_medido,
        estado_equipo: eq.estado_equipo
      })),
      causas_alto_consumo: revisionResult.causas_alto_consumo || [],
      recomendaciones_tecnico: revisionResult.recomendaciones_tecnico || '',
      firma_base64: firmaUrl
    };

    try {
      console.log('Generando PDF localmente...');
      const pdfBuffer = await generarPDF(datosParaPdf);

      if (pdfBuffer) {
        const pdfPath = `reportes/reporte-${newRevisionId}.pdf`;
        const { error: upPdfErr } = await supabaseAdmin.storage.from('reportes').upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

        if (upPdfErr) throw upPdfErr;

        const { data: urlData } = supabaseAdmin.storage.from('reportes').getPublicUrl(pdfPath);
        pdfUrl = urlData.publicUrl;

        console.log('PDF subido y URL generada:', pdfUrl);
        await supabaseAdmin.from('revisiones').update({ pdf_url: pdfUrl }).eq('id', newRevisionId);
      }
    } catch (pdfError) {
      console.error('Error generando/subiendo PDF:', pdfError.message);
    }

    // 6. EMAIL
    if (pdfUrl && revisionResult.cliente_email && casoData?.cliente_nombre) {
      await enviarReportePorEmail(
        revisionResult.cliente_email,
        casoData.cliente_nombre,
        pdfUrl,
        revisionResult.causas_alto_consumo
      );
    }

    return {
      message: `Revisión guardada y PDF generado.`,
      revision_id: newRevisionId,
      pdf_url: pdfUrl
    };

  } catch (error) {
    console.error('Fatal:', error.message);
    throw error;
  }
};