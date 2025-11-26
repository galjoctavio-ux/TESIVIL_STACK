import { supabaseAdmin } from './supabaseClient.js';
import { Buffer } from 'buffer';
import {
  calcularConsumoEquipos,
  detectarFugas,
  verificarSolar,
  generarDiagnosticosAutomaticos
} from './calculos.service.js';
import { enviarReportePorEmail } from './email.service.js';
import { generarPDF } from './pdf.service.js';

export const processRevision = async (payload, tecnicoAuth) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData" en la solicitud.');
  }

  console.log(`[RevisionService] Procesando revisión. Caso ID: ${revisionData.caso_id || 'N/A'}`);

  // ---------------------------------------------------------
  // 0. OBTENER DATOS DEL PERFIL DEL INGENIERO (CORREGIDO)
  // ---------------------------------------------------------
  let nombreIngeniero = 'Ingeniero Especialista';
  let firmaIngenieroUrl = null;

  try {
    // 1. Intentamos buscar en la tabla 'profiles'
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('profiles')
      .select('nombre, firma_url')
      .eq('user_id', tecnicoAuth.id)
      .single();

    if (!perfilError && perfil) {
      nombreIngeniero = perfil.nombre || tecnicoAuth.user_metadata?.full_name || tecnicoAuth.email;
      firmaIngenieroUrl = perfil.firma_url;
    } else {
      // 2. Si falla, intentamos sacar el nombre de los metadatos del auth (si existen)
      console.warn('No se halló perfil, usando fallback de Auth.');
      nombreIngeniero = tecnicoAuth.user_metadata?.full_name || tecnicoAuth.email;
    }
  } catch (e) {
    console.error('Error recuperando perfil ingeniero:', e.message);
    nombreIngeniero = tecnicoAuth.email; // Último recurso
  }

  // ---------------------------------------------------------
  // 1. SANITIZACIÓN Y NORMALIZACIÓN DE DATOS
  // ---------------------------------------------------------
  const datosDeTrabajo = { ...revisionData };

  // Asegurar números para evitar errores matemáticos
  datosDeTrabajo.fuga_total = parseFloat(datosDeTrabajo.fuga_total) || 0;
  datosDeTrabajo.voltaje_medido = parseFloat(datosDeTrabajo.voltaje_medido) || 0;
  datosDeTrabajo.caso_id = Number(datosDeTrabajo.caso_id);

  // Corrección de nombres de variables (Frontend vs Backend)
  if (datosDeTrabajo.antiguedad_paneles !== undefined) {
    datosDeTrabajo.paneles_antiguedad_anos = parseInt(datosDeTrabajo.antiguedad_paneles) || 0;
  }

  // Si el voltaje medido es 0, intentar usar el voltaje fase-neutro reportado en el formulario
  if (datosDeTrabajo.voltaje_fn && datosDeTrabajo.voltaje_medido === 0) {
    datosDeTrabajo.voltaje_medido = parseFloat(datosDeTrabajo.voltaje_fn) || 127;
  }

  // Limpiar array de equipos (Asegurar tipos de datos)
  const equiposSanitizados = equiposData.map(eq => ({
    nombre_equipo: eq.nombre_equipo,
    nombre_personalizado: eq.nombre_personalizado || '',
    estado_equipo: eq.estado_equipo,
    unidad_tiempo: eq.unidad_tiempo || 'Horas/Día',
    tiempo_uso: parseFloat(eq.horas_uso || eq.tiempo_uso) || 0,
    amperaje_medido: parseFloat(eq.amperaje_medido) || 0,
    cantidad: parseFloat(eq.cantidad) || 1
  }));

  let casoData = null;
  let pdfUrl = null;
  let firmaClienteUrl = null; // Variable para la firma del cliente (PWA)
  let revisionResult = null;

  try {
    // ---------------------------------------------------------
    // 2. CÁLCULOS TÉCNICOS
    // ---------------------------------------------------------
    const voltajeCalculo = datosDeTrabajo.voltaje_medido > 0 ? datosDeTrabajo.voltaje_medido : 127;

    // Calculamos consumo individual
    let equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltajeCalculo);

    // ORDENAMIENTO: De mayor a menor consumo (Top Consumidores) - Requerimiento Top
    equiposCalculados.sort((a, b) => (b.kwh_bimestre_calculado || 0) - (a.kwh_bimestre_calculado || 0));

    // Cálculo del Total Bimestral Estimado (Suma)
    const totalKwhBimestre = equiposCalculados.reduce((acc, curr) => acc + (curr.kwh_bimestre_calculado || 0), 0);

    // Diagnósticos adicionales
    const diagnosticoFuga = detectarFugas(datosDeTrabajo);
    const diagnosticoSolar = verificarSolar(datosDeTrabajo);
    const diagnosticos = generarDiagnosticosAutomaticos(datosDeTrabajo, equiposCalculados, diagnosticoFuga, diagnosticoSolar);

    // ---------------------------------------------------------
    // 3. GUARDADO EN BASE DE DATOS (Supabase)
    // ---------------------------------------------------------
    const datosParaInsertar = { ...datosDeTrabajo };

    // Eliminar campos temporales que no existen en la tabla 'revisiones'
    delete datosParaInsertar.voltaje_fn;
    delete datosParaInsertar.fuga_total;
    delete datosParaInsertar.amperaje_medido;
    delete datosParaInsertar.antiguedad_paneles;

    datosParaInsertar.tecnico_id = tecnicoAuth.id; // Usamos el ID autenticado
    datosParaInsertar.diagnosticos_automaticos = diagnosticos;
    datosParaInsertar.fecha_revision = new Date().toISOString();

    // Insertar Revisión
    const { data: revData, error: revError } = await supabaseAdmin
      .from('revisiones')
      .insert(datosParaInsertar)
      .select()
      .single();

    if (revError) throw new Error(`Error insertando revisión: ${revError.message}`);
    revisionResult = revData;
    const newRevisionId = revisionResult.id;

    // Insertar Equipos Calculados
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
      if (eqErr) throw new Error(`Error insertando equipos: ${eqErr.message}`);
    }

    // Actualizar Caso y obtener info del Cliente (Nombre y Dirección para el PDF)
    const { data: casoUpdated, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', datosDeTrabajo.caso_id)
      // --- CAMBIO CLAVE AQUÍ ---
      // Antes: .select('cliente_nombre, cliente_direccion')
      // Ahora: Usamos la relación con la tabla clientes
      .select('id, cliente:clientes(nombre_completo, direccion_principal)')
      // -------------------------
      .single();

    if (casoError) console.warn(`Advertencia: No se pudo actualizar el caso ${datosDeTrabajo.caso_id}`, casoError);
    casoData = casoUpdated;

    // ---------------------------------------------------------
    // 4. PROCESAMIENTO DE FIRMA CLIENTE (Desde PWA)
    // ---------------------------------------------------------
    if (firmaBase64) {
      try {
        const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const data = Buffer.from(matches[2], 'base64');
          // Guardamos la firma del cliente
          const filePath = `firmas/revision-cliente-${newRevisionId}.png`;

          const { error: upErr } = await supabaseAdmin.storage.from('reportes').upload(filePath, data, { contentType, upsert: true });
          if (!upErr) {
            const { data: urlData } = supabaseAdmin.storage.from('reportes').getPublicUrl(filePath);
            firmaClienteUrl = urlData.publicUrl;

            // Actualizamos la revisión con la firma del cliente
            await supabaseAdmin.from('revisiones').update({ firma_url: firmaClienteUrl }).eq('id', newRevisionId);
          }
        }
      } catch (errFirma) {
        console.error('Error procesando firma del cliente:', errFirma);
      }
    }

    // ---------------------------------------------------------
    // 5. GENERACIÓN DE PDF (Node.js + Gemini + Upsell)
    // ---------------------------------------------------------
    const datosParaPdf = {
      header: {
        id: newRevisionId,
        fecha_revision: revisionResult.created_at || new Date().toISOString(),
        // --- CAMBIO CLAVE AQUÍ TAMBIÉN ---
        // Accedemos a través del objeto anidado 'cliente'
        cliente_nombre: casoData?.cliente?.nombre_completo || 'Cliente',
        cliente_direccion: casoData?.cliente?.direccion_principal || '',
        // --------------------------------
        cliente_email: revisionResult.cliente_email || '',
        tecnico_nombre: nombreIngeniero,
        firma_ingeniero_url: firmaIngenieroUrl
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
        // Solar
        cantidad_paneles: revisionResult.cantidad_paneles,
        watts_por_panel: revisionResult.watts_por_panel,
        paneles_antiguedad_anos: revisionResult.paneles_antiguedad_anos
      },
      // Equipos formateados para la tabla del PDF
      equipos: equiposCalculados.map(eq => ({
        nombre_equipo: eq.nombre_equipo,
        ubicacion: eq.nombre_personalizado,
        amperaje: eq.amperaje_medido,
        estado_equipo: eq.estado_equipo,
        kwh_bimestre: eq.kwh_bimestre_calculado // Dato clave para el reporte
      })),
      consumo_total_estimado: totalKwhBimestre,
      causas_alto_consumo: revisionResult.causas_alto_consumo || [],
      recomendaciones_tecnico: revisionResult.recomendaciones_tecnico || '',
      firma_cliente_url: firmaClienteUrl // Pasamos la firma del cliente al PDF
    };

    try {
      console.log('Iniciando generación de PDF local con Upsell...');
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

        console.log('PDF generado y subido exitosamente:', pdfUrl);
        // Guardamos la URL del PDF generado
        await supabaseAdmin.from('revisiones').update({ pdf_url: pdfUrl }).eq('id', newRevisionId);
      }
    } catch (pdfError) {
      console.error('Error crítico generando PDF:', pdfError.message);
      // No lanzamos error para no deshacer la transacción de la BD, pero el PDF faltará.
    }

    // ---------------------------------------------------------
    // 6. ENVÍO DE CORREO
    // ---------------------------------------------------------
    if (pdfUrl && revisionResult.cliente_email) {
      console.log(`Enviando reporte por correo a: ${revisionResult.cliente_email}`);
      await enviarReportePorEmail(
        revisionResult.cliente_email,
        casoData?.cliente_nombre || 'Cliente',
        pdfUrl,
        revisionResult.causas_alto_consumo
      );
    }

    return {
      message: 'Revisión completada exitosamente.',
      revision_id: newRevisionId,
      pdf_url: pdfUrl
    };

  } catch (error) {
    console.error('[RevisionService] Error Fatal:', error.message);
    throw error;
  }
};