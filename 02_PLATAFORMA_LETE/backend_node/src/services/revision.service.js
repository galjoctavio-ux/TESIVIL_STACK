import { supabaseAdmin, supabaseKey } from './supabaseClient.js';
import { Buffer } from 'buffer';
import axios from 'axios';
import { 
  calcularConsumoEquipos,
  detectarFugas,
  verificarSolar,
  generarDiagnosticosAutomaticos 
} from './calculos.service.js';
import { enviarReportePorEmail } from './email.service.js';

export const processRevision = async (payload, tecnico) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData"');
  }

  // ---------------------------------------------------------
  // 1. SANITIZACIÓN DE DATOS GENERALES
  // ---------------------------------------------------------
  const datosDeTrabajo = { ...revisionData };

  // Corrección de tipos numéricos
  datosDeTrabajo.fuga_total = parseFloat(datosDeTrabajo.fuga_total) || 0;
  datosDeTrabajo.voltaje_medido = parseFloat(datosDeTrabajo.voltaje_medido) || 0;
  
  // Manejo de voltaje_fn si existe
  if (datosDeTrabajo.voltaje_fn) {
    const vFn = parseFloat(datosDeTrabajo.voltaje_fn) || 0;
    if (datosDeTrabajo.voltaje_medido === 0) {
      datosDeTrabajo.voltaje_medido = vFn;
    }
  }

  if (datosDeTrabajo.caso_id) {
      datosDeTrabajo.caso_id = Number(datosDeTrabajo.caso_id);
  }

  // ---------------------------------------------------------
  // 2. SANITIZACIÓN DE EQUIPOS (Mapeo Frontend -> Backend)
  // ---------------------------------------------------------
  const equiposSanitizados = equiposData.map(eq => ({
      nombre_equipo: eq.nombre_equipo,
      nombre_personalizado: eq.nombre_personalizado || '', 
      estado_equipo: eq.estado_equipo,
      unidad_tiempo: eq.unidad_tiempo || 'Horas/Día',
      // Mapeamos 'horas_uso' a 'tiempo_uso'
      tiempo_uso: parseFloat(eq.horas_uso || eq.tiempo_uso) || 0,
      amperaje_medido: parseFloat(eq.amperaje_medido) || 0,
      cantidad: parseFloat(eq.cantidad) || 1 
  }));

  console.log(`Procesando revisión para el caso ${datosDeTrabajo.caso_id} por el técnico ${tecnico.email}`);

  let casoData; 
  let pdfUrl = null; 

  try {
    // ---------------------------------------------------------
    // 3. CÁLCULOS
    // ---------------------------------------------------------
    const voltajeCalculo = datosDeTrabajo.voltaje_medido > 0 ? datosDeTrabajo.voltaje_medido : 127;

    const equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltajeCalculo);
    
    const diagnosticoFuga = detectarFugas(datosDeTrabajo);
    const diagnosticoSolar = verificarSolar(datosDeTrabajo);
    
    const diagnosticos = generarDiagnosticosAutomaticos(
      datosDeTrabajo,
      equiposCalculados, 
      diagnosticoFuga, 
      diagnosticoSolar
    );

    // ---------------------------------------------------------
    // 4. GUARDADO EN BASE DE DATOS (LISTA BLANCA)
    // ---------------------------------------------------------
    
    // Preparar objeto REVISIONES
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

    // Preparar objeto EQUIPOS
    let equiposProcesados = 0;
    if (equiposCalculados.length > 0) {
        const equiposParaInsertar = equiposCalculados.map(equipo => ({
          revision_id: newRevisionId,
          nombre_equipo: equipo.nombre_equipo,
          nombre_personalizado: equipo.nombre_personalizado,
          amperaje_medido: equipo.amperaje_medido,
          tiempo_uso: equipo.tiempo_uso,
          unidad_tiempo: equipo.unidad_tiempo,
          estado_equipo: equipo.estado_equipo,
          kwh_bimestre_calculado: equipo.kwh_bimestre_calculado
        }));

        const { error: equiposError } = await supabaseAdmin
          .from('equipos_revisados')
          .insert(equiposParaInsertar);
          
        if (equiposError) throw equiposError;
        equiposProcesados = equiposParaInsertar.length;
        console.log(`Guardados ${equiposProcesados} equipos para la revisión ${newRevisionId}`);
    }

    // --- Actualizar Status del Caso ---
    const { data: casoUpdated, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', datosDeTrabajo.caso_id)
      .select('cliente_nombre, cliente_direccion') 
      .single();

    if (casoError) console.warn(`Error al actualizar caso ${datosDeTrabajo.caso_id}:`, casoError.message);
    casoData = casoUpdated;

    // ---------------------------------------------------------
    // 5. PROCESAMIENTO DE FIRMA
    // ---------------------------------------------------------
    let firmaUrl = null;
    if (firmaBase64) {
        console.log('Procesando firma...');
        const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) throw new Error('Formato de firmaBase64 inválido');

        const contentType = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filePath = `firmas/revision-${newRevisionId}.png`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('reportes')
          .upload(filePath, data, { contentType });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseAdmin.storage.from('reportes').getPublicUrl(filePath);
        firmaUrl = urlData.publicUrl;
        
        await supabaseAdmin
          .from('revisiones')
          .update({ firma_url: firmaUrl })
          .eq('id', newRevisionId);
    }

    // ---------------------------------------------------------
    // 6. GENERACIÓN PDF (PHP) Y EMAIL
    // ---------------------------------------------------------
    
    // CORRECCIÓN CRÍTICA: Apuntamos directo al puerto 8081 para evitar el filtro de Nginx
    const phpPdfEndpoint = process.env.PHP_PDF_ENDPOINT || 'http://localhost:8081/api/revisiones/generar_pdf_final';

    console.log(`Delegando generación de PDF a: ${phpPdfEndpoint} (Revision ID: ${newRevisionId})`);

    try {
        const response = await axios.post(phpPdfEndpoint, {
            revision_id: newRevisionId
        });

        if (response.data && response.data.pdf_url) {
            pdfUrl = response.data.pdf_url;
            console.log('PDF generado correctamente:', pdfUrl);
            
            await supabaseAdmin
                .from('revisiones')
                .update({ pdf_url: pdfUrl })
                .eq('id', newRevisionId);
        } else {
             console.warn('PHP respondió 200 OK pero no devolvió pdf_url:', response.data);
        }
    } catch (axiosError) {
        console.error('Error al llamar al servicio de PHP:', axiosError.message);
        if (axiosError.response) {
            console.error('Status PHP:', axiosError.response.status);
            console.error('Respuesta PHP:', axiosError.response.data);
        } else {
            console.error('No hubo respuesta del servidor PHP (posible error de conexión o URL incorrecta).');
        }
    }

    if (pdfUrl && revisionResult.cliente_email && casoData?.cliente_nombre) {
      await enviarReportePorEmail(
        revisionResult.cliente_email,
        casoData.cliente_nombre,
        pdfUrl,
        revisionResult.causas_alto_consumo 
      );
    }

    return {
      message: `Revisión guardada. ${equiposProcesados} equipos.`,
      revision_id: newRevisionId,
      pdf_url: pdfUrl
    };

  } catch (error) {
      console.error('Error fatal durante el procesamiento de la revisión:', error.message);
      throw error;
  }
};