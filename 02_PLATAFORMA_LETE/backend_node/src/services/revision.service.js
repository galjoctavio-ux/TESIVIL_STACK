import { supabaseAdmin } from './supabaseClient.js';
import { Buffer } from 'buffer';
import {
  calcularConsumoEquipos,
  generarDiagnosticosAutomaticos,
  detectarFugas,
  verificarSolar
} from './calculos.service.js';
import { enviarReportePorEmail } from './email.service.js';
import { generarPDF } from './pdf.service.js';

/**
 * Helpers
 */
const safeParseFloat = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const uploadBufferToStorage = async (bucket, path, buffer, contentType) => {
  try {
    const { error: upErr } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true
    });
    if (upErr) {
      console.error(`Error subiendo ${path} a storage:`, upErr.message || upErr);
      return null;
    }
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Error en uploadBufferToStorage:', err);
    return null;
  }
};

export const processRevision = async (payload, tecnicoAuth) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData" en la solicitud.');
  }

  console.log(`[RevisionService] Procesando revisión final. Caso ID: ${revisionData.caso_id || 'N/A'}`);

  // -----------------------
  // 0. Perfil del ingeniero
  // -----------------------
  let nombreIngeniero = 'Ingeniero Especialista';
  let firmaIngenieroUrl = null;

  try {
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('profiles')
      .select('nombre, firma_url')
      .eq('user_id', tecnicoAuth.id)
      .maybeSingle();

    if (!perfilError && perfil) {
      nombreIngeniero = perfil.nombre || tecnicoAuth.user_metadata?.full_name || nombreIngeniero;
      firmaIngenieroUrl = perfil.firma_url || null;
    } else {
      nombreIngeniero = tecnicoAuth.user_metadata?.full_name || tecnicoAuth.email || nombreIngeniero;
    }
  } catch (e) {
    console.error('Error recuperando perfil ingeniero:', e?.message || e);
    nombreIngeniero = tecnicoAuth.email || nombreIngeniero;
  }

  // ---------------------------------------------------------
  // 1. Sanitización y lógica de negocios
  // ---------------------------------------------------------
  const datosDeTrabajo = { ...revisionData };
  datosDeTrabajo.caso_id = Number(datosDeTrabajo.caso_id);

  // Lecturas eléctricas
  const iFase1 = safeParseFloat(datosDeTrabajo.corriente_red_f1, 0);
  const iNeutro = safeParseFloat(datosDeTrabajo.corriente_red_n, 0);
  const iFugaPinza = safeParseFloat(datosDeTrabajo.corriente_fuga_f1, 0);
  const voltaje = safeParseFloat(datosDeTrabajo.voltaje_medido, 127);
  const sePuedeApagar = datosDeTrabajo.se_puede_apagar_todo === true || datosDeTrabajo.se_puede_apagar_todo === 'true';

  // Financieros / metadata
  const kwhRecibo = safeParseFloat(datosDeTrabajo.kwh_recibo_cfe, 0);
  const tarifa = datosDeTrabajo.tarifa_cfe || '01';
  const condicionInfra = datosDeTrabajo.condicion_infraestructura || 'Regular';
  const midieronCargasMenores = datosDeTrabajo.se_midieron_cargas_menores === true || datosDeTrabajo.se_midieron_cargas_menores === 'true';

  // Cálculo inteligente de fuga
  if (sePuedeApagar) {
    datosDeTrabajo.corriente_fuga_f1 = iFase1;
  } else {
    if (iNeutro > (iFase1 + 0.5)) {
      datosDeTrabajo.corriente_fuga_f1 = iNeutro - iFase1;
    } else {
      datosDeTrabajo.corriente_fuga_f1 = iFugaPinza;
    }
  }

  // Procesamiento y sanitización de equipos
  const equiposSanitizados = (equiposData || []).map(eq => ({
    nombre_equipo: eq.nombre_equipo,
    nombre_personalizado: eq.nombre_personalizado || '',
    estado_equipo: eq.estado_equipo || 'Desconocido',
    unidad_tiempo: eq.unidad_tiempo || 'Horas/Día',
    tiempo_uso: safeParseFloat(eq.horas_uso ?? eq.tiempo_uso, 0),
    amperaje_medido: safeParseFloat(eq.amperaje_medido, 0),
    cantidad: safeParseFloat(eq.cantidad, 1)
  }));

  // Consumo por equipo
  let equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltaje) || [];
  equiposCalculados.sort((a, b) => (b.kwh_bimestre_calculado || 0) - (a.kwh_bimestre_calculado || 0));

  // Totales / ajuste por cargas menores
  const totalKwhAuditado = equiposCalculados.reduce((acc, c) => acc + (c.kwh_bimestre_calculado || 0), 0);
  const factorHolgura = midieronCargasMenores ? 1.0 : 1.20;
  const totalAuditadoAjustado = totalKwhAuditado * factorHolgura;

  let kwhDesperdicio = 0;
  let porcentajeFuga = 0;
  let alertaFuga = false;

  if (kwhRecibo > 0) {
    kwhDesperdicio = kwhRecibo - totalAuditadoAjustado;
    if (kwhDesperdicio < 0) kwhDesperdicio = 0;
    porcentajeFuga = (kwhDesperdicio / kwhRecibo) * 100;
    alertaFuga = porcentajeFuga >= 15;
  }

  // Detecciones adicionales (si tus servicios lo proveen)
  let resultadoDeteccionFugas = null;
  try {
    if (typeof detectarFugas === 'function') {
      resultadoDeteccionFugas = detectarFugas(datosDeTrabajo, equiposCalculados);
    }
  } catch (err) {
    console.warn('detectarFugas falló:', err?.message || err);
  }

  let resultadoVerificarSolar = null;
  try {
    if (typeof verificarSolar === 'function' && datosDeTrabajo.antiguedad_paneles != null) {
      resultadoVerificarSolar = verificarSolar(datosDeTrabajo);
    }
  } catch (err) {
    console.warn('verificarSolar falló:', err?.message || err);
  }

  // Generar textos automáticos
  const diagnosticosAuto = generarDiagnosticosAutomaticos(datosDeTrabajo, equiposCalculados, {
    deteccionFugas: resultadoDeteccionFugas,
    verificarSolar: resultadoVerificarSolar
  });

  // ---------------------------------------------------------
  // 2. Guardado en BD (revisiones + equipos_revisados)
  // ---------------------------------------------------------
  const datosParaInsertar = { ...datosDeTrabajo };

  // Limpiar campos temporales que no están en la tabla
  delete datosParaInsertar.voltaje_fn;
  delete datosParaInsertar.fuga_total;
  delete datosParaInsertar.amperaje_medido;
  delete datosParaInsertar.antiguedad_paneles;
  delete datosParaInsertar.equiposData;

  // Campos extra
  datosParaInsertar.tecnico_id = tecnicoAuth.id;
  datosParaInsertar.diagnosticos_automaticos = diagnosticosAuto;
  datosParaInsertar.fecha_revision = new Date().toISOString();
  datosParaInsertar.tarifa_cfe = tarifa;
  datosParaInsertar.kwh_recibo_cfe = kwhRecibo;
  datosParaInsertar.condicion_infraestructura = condicionInfra;
  datosParaInsertar.se_midieron_cargas_menores = midieronCargasMenores;
  // Opcionales: datos de detecciones automatizadas
  if (resultadoDeteccionFugas) datosParaInsertar.resultado_deteccion_fugas = resultadoDeteccionFugas;
  if (resultadoVerificarSolar) datosParaInsertar.resultado_verificar_solar = resultadoVerificarSolar;

  const { data: revData, error: revError } = await supabaseAdmin
    .from('revisiones')
    .insert(datosParaInsertar)
    .select()
    .single();

  if (revError) {
    console.error('Error insertando revisión:', revError);
    throw new Error(`Error insertando revisión: ${revError.message || revError}`);
  }

  const newRevisionId = revData.id;

  // Insertar equipos revisados
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

    try {
      const { error: eqErr } = await supabaseAdmin.from('equipos_revisados').insert(equiposInsert);
      if (eqErr) console.error('Error insertando equipos:', eqErr.message || eqErr);
    } catch (err) {
      console.error('Excepción insertando equipos:', err);
    }
  }

  // Actualizar status del caso y obtener cliente (relacional)
  let casoUpdated = null;
  try {
    const { data: casoData, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', datosDeTrabajo.caso_id)
      .select('id, cliente:clientes(nombre_completo, direccion_principal, email)')
      .single();

    if (casoError) {
      console.warn('No se pudo actualizar el caso:', casoError.message || casoError);
    } else {
      casoUpdated = casoData;
    }
  } catch (err) {
    console.warn('Error actualizando caso:', err);
  }

  // Si no obtuvimos cliente por la actualización, intentamos leer caso sin update
  if (!casoUpdated) {
    try {
      const { data: casoFetch, error: casoFetchErr } = await supabaseAdmin
        .from('casos')
        .select('id, cliente:clientes(nombre_completo, direccion_principal, email)')
        .eq('id', datosDeTrabajo.caso_id)
        .maybeSingle();

      if (!casoFetchErr) casoUpdated = casoFetch;
    } catch (err) {
      console.warn('No se pudo recuperar info del caso:', err);
    }
  }

  // ---------------------------------------------------------
  // 3. Procesamiento de firma del cliente (si viene)
  // ---------------------------------------------------------
  let firmaClienteUrl = null;
  if (firmaBase64) {
    try {
      const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const bufferData = Buffer.from(matches[2], 'base64');
        const filePath = `firmas/revision-cliente-${newRevisionId}.png`;
        const publicUrl = await uploadBufferToStorage('reportes', filePath, bufferData, contentType);
        if (publicUrl) {
          firmaClienteUrl = publicUrl;
          // Guardar en la revisión
          await supabaseAdmin.from('revisiones').update({ firma_url: firmaClienteUrl }).eq('id', newRevisionId);
        }
      } else {
        console.warn('Formato de firmaBase64 no reconocido.');
      }
    } catch (errFirma) {
      console.error('Error procesando firma:', errFirma);
    }
  }

  // ---------------------------------------------------------
  // 4. Generación de PDF
  // ---------------------------------------------------------
  let pdfUrl = null;
  const datosParaPdf = {
    header: {
      id: newRevisionId,
      fecha_revision: revData.fecha_revision,
      cliente_nombre: casoUpdated?.cliente?.nombre_completo || 'Cliente',
      cliente_direccion: casoUpdated?.cliente?.direccion_principal || 'Dirección no registrada',
      cliente_email: revData.cliente_email || casoUpdated?.cliente?.email || '',
      tecnico_nombre: nombreIngeniero,
      firma_ingeniero_url: firmaIngenieroUrl,
      tarifa,
      condicion_infra: condicionInfra
    },
    mediciones: {
      ...datosDeTrabajo,
      corriente_fuga_f1: datosDeTrabajo.corriente_fuga_f1
    },
    finanzas: {
      kwh_recibo: kwhRecibo,
      kwh_auditado: totalKwhAuditado,
      kwh_ajustado: totalAuditadoAjustado,
      kwh_desperdicio: kwhDesperdicio,
      porcentaje_desperdicio: porcentajeFuga,
      alerta_fuga: alertaFuga
    },
    detecciones: {
      fugas: resultadoDeteccionFugas,
      solar: resultadoVerificarSolar
    },
    equipos: equiposCalculados,
    consumo_total_estimado: totalAuditadoAjustado,
    causas_alto_consumo: revData.diagnosticos_automaticos || [],
    recomendaciones_tecnico: revData.recomendaciones_tecnico || '',
    firma_cliente_url: firmaClienteUrl
  };

  try {
    console.log('Generando PDF...');
    const pdfBuffer = await generarPDF(datosParaPdf);

    if (pdfBuffer) {
      const pdfPath = `reportes/reporte-${newRevisionId}.pdf`;
      const publicPdfUrl = await uploadBufferToStorage('reportes', pdfPath, pdfBuffer, 'application/pdf');
      if (publicPdfUrl) {
        pdfUrl = publicPdfUrl;
        // Guardar URL en la revisión
        await supabaseAdmin.from('revisiones').update({ pdf_url: pdfUrl }).eq('id', newRevisionId);
        console.log('PDF generado y subido:', pdfUrl);
      } else {
        console.error('No se pudo obtener URL pública del PDF subido.');
      }
    } else {
      console.warn('generarPDF devolvió buffer vacío o nulo.');
    }
  } catch (pdfError) {
    console.error('Error en proceso de PDF:', pdfError);
  }

  // ---------------------------------------------------------
  // 5. Envío de correo (solo si hay PDF y email)
  // ---------------------------------------------------------
  const clienteEmail = revData.cliente_email || casoUpdated?.cliente?.email || '';
  if (pdfUrl && clienteEmail) {
    try {
      console.log(`Enviando email a ${clienteEmail}...`);
      await enviarReportePorEmail(
        clienteEmail,
        casoUpdated?.cliente?.nombre_completo || 'Cliente Estimado',
        pdfUrl,
        revData.diagnosticos_automaticos
      );
    } catch (mailErr) {
      console.error('Error enviando correo:', mailErr?.message || mailErr);
    }
  } else {
    if (!pdfUrl) console.warn('No se envió correo: no existe pdfUrl.');
    if (!clienteEmail) console.warn('No se envió correo: no existe clienteEmail.');
  }

  // Resultado final
  return {
    success: true,
    message: 'Revisión guardada exitosamente.',
    revision_id: newRevisionId,
    pdf_url: pdfUrl
  };
};
