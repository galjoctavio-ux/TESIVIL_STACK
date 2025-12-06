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
// Importamos la función para notificar al técnico
import { sendNotificationToEmail } from '../controllers/notifications.controller.js';
/**
 * Helpers
 */
const safeParseFloat = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

// Función para subir archivos respetando tu estructura de carpetas
const uploadBufferToStorage = async (bucket, path, buffer, contentType) => {
  try {
    const { error: upErr } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true
    });

    if (upErr) {
      console.error(`Error subiendo ${path} a storage:`, upErr.message || upErr);
      throw upErr; // Lanzamos error para manejarlo en el catch superior
    }

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Error en uploadBufferToStorage:', err);
    throw err;
  }
};

/**
 * ==================================================================
 * FASE 1: RÁPIDA (Síncrona)
 * Realiza cálculos, guarda en BD y retorna el ID inmediatamente.
 * NO genera PDF ni envía correos aquí.
 * ==================================================================
 */
export const crearRegistroRevision = async (payload, tecnicoAuth) => {
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
      .eq('id', tecnicoAuth.id)
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

  // --- LECTURAS ELÉCTRICAS (RED - MULTIFASE) ---
  const tipoServicio = datosDeTrabajo.tipo_servicio || 'Monofásico';
  const iFase1 = safeParseFloat(datosDeTrabajo.corriente_red_f1, 0);
  const iFase2 = safeParseFloat(datosDeTrabajo.corriente_red_f2, 0);
  const iFase3 = safeParseFloat(datosDeTrabajo.corriente_red_f3, 0);
  const iNeutro = safeParseFloat(datosDeTrabajo.corriente_red_n, 0);

  // --- LECTURAS ELÉCTRICAS (PANELES) ---
  datosDeTrabajo.corriente_paneles_f1 = safeParseFloat(datosDeTrabajo.corriente_paneles_f1, 0);
  datosDeTrabajo.corriente_paneles_f2 = safeParseFloat(datosDeTrabajo.corriente_paneles_f2, 0);
  datosDeTrabajo.corriente_paneles_f3 = safeParseFloat(datosDeTrabajo.corriente_paneles_f3, 0);

  const iFugaPinza = safeParseFloat(datosDeTrabajo.corriente_fuga_f1, 0);
  const voltaje = safeParseFloat(datosDeTrabajo.voltaje_medido, 127);
  const sePuedeApagar = datosDeTrabajo.se_puede_apagar_todo === true || datosDeTrabajo.se_puede_apagar_todo === 'true';

  // Financieros / metadata
  const kwhRecibo = safeParseFloat(datosDeTrabajo.kwh_recibo_cfe, 0);
  const tarifa = datosDeTrabajo.tarifa_cfe || '01';
  const condicionInfra = datosDeTrabajo.condicion_infraestructura || 'Regular';
  const midieronCargasMenores = datosDeTrabajo.se_midieron_cargas_menores === true || datosDeTrabajo.se_midieron_cargas_menores === 'true';

  // --- CÁLCULO INTELIGENTE DE FUGA (Multifase) ---
  let corrienteFugaCalculada = 0;

  if (sePuedeApagar) {
    // Si se apaga todo, sumamos lo que marque la pinza en todas las fases
    corrienteFugaCalculada = iFase1 + iFase2 + iFase3;
  } else {
    // Lógica por tipo de servicio
    switch (tipoServicio) {
      case 'Trifásico':
        // Fórmula: abs(F1 + F2 + F3) - N
        const sumaTrifasica = iFase1 + iFase2 + iFase3;
        const diffTrifasica = Math.abs(sumaTrifasica) - iNeutro;
        corrienteFugaCalculada = diffTrifasica > 0 ? diffTrifasica : 0;
        break;

      case 'Bifásico':
        // Fórmula: abs(F1 + F2) - N
        const sumaBifasica = iFase1 + iFase2;
        const diffBifasica = Math.abs(sumaBifasica) - iNeutro;
        corrienteFugaCalculada = diffBifasica > 0 ? diffBifasica : 0;
        break;

      case 'Monofásico':
      default:
        // Lógica original Monofásica
        if (iNeutro > (iFase1 + 0.5)) {
          corrienteFugaCalculada = iNeutro - iFase1;
        } else {
          corrienteFugaCalculada = iFugaPinza;
        }
        break;
    }
  }
  // Actualizamos el dato maestro de fuga
  datosDeTrabajo.corriente_fuga_f1 = corrienteFugaCalculada;

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

  // Consumo por equipo (Cálculo base)
  let equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltaje) || [];
  equiposCalculados.sort((a, b) => (b.kwh_bimestre_calculado || 0) - (a.kwh_bimestre_calculado || 0));

  // --- CÁLCULOS AVANZADOS DE DESPERDICIO ---

  // 1. Fuga en Infraestructura (V * A_Fuga * 24h * 60d / 1000)
  const kwhFugaInfraestructura = (voltaje * datosDeTrabajo.corriente_fuga_f1 * 24 * 60) / 1000;

  // 2. Ineficiencia de Equipos (Suma total de consumo de equipos Malos o Regulares)
  let kwhIneficienciaEquipos = 0;
  equiposCalculados.forEach(eq => {
    if (eq.estado_equipo === 'Malo' || eq.estado_equipo === 'Regular') {
      kwhIneficienciaEquipos += (eq.kwh_bimestre_calculado || 0);
    }
  });

  // 3. Consumo Auditado Ajustado (Totales / ajuste por cargas menores)
  const totalKwhAuditado = equiposCalculados.reduce((acc, c) => acc + (c.kwh_bimestre_calculado || 0), 0);
  const factorHolgura = midieronCargasMenores ? 1.0 : 1.20;
  const totalAuditadoAjustado = totalKwhAuditado * factorHolgura;

  // 4. Consumo No Identificado (Diferencia aritmética vs Recibo CFE)
  let kwhNoIdentificado = kwhRecibo - totalAuditadoAjustado;
  if (kwhNoIdentificado < 0) kwhNoIdentificado = 0;

  // 5. TOTAL DESPERDICIO (Sumatoria de los 3 componentes de pérdida)
  const kwhDesperdicioTotal = kwhFugaInfraestructura + kwhIneficienciaEquipos + kwhNoIdentificado;

  // Porcentaje de impacto
  let porcentajeFuga = 0;
  let alertaFuga = false;
  if (kwhRecibo > 0) {
    porcentajeFuga = (kwhDesperdicioTotal / kwhRecibo) * 100;
    alertaFuga = porcentajeFuga >= 15;
  }

  // --- CORRECCIÓN DE DATOS (Sanitización) ---

  // Limpiar [object Object]
  const causasLimpias = (datosDeTrabajo.causas_alto_consumo || []).map(item => {
    if (typeof item === 'object' && item !== null) return item.texto || item.value || '';
    return String(item);
  }).filter(t => t.trim() !== '');

  datosDeTrabajo.causas_alto_consumo = causasLimpias;


  // --- DETECCIONES AUTOMÁTICAS EXTERNAS ---
  let resultadoDeteccionFugas = null;
  try {
    if (typeof detectarFugas === 'function') {
      resultadoDeteccionFugas = detectarFugas(datosDeTrabajo, equiposCalculados);
    }
  } catch (err) {
    console.warn('detectarFugas falló:', err?.message || err);
  }

  // Lógica Solar Mejorada
  let resultadoVerificarSolar = null;
  const tienePaneles = datosDeTrabajo.antiguedad_paneles != null ||
    datosDeTrabajo.corriente_paneles_f1 > 0 ||
    datosDeTrabajo.cantidad_paneles > 0;

  try {
    if (typeof verificarSolar === 'function' && tienePaneles) {
      resultadoVerificarSolar = verificarSolar(datosDeTrabajo);
    }
  } catch (err) {
    console.warn('verificarSolar falló:', err?.message || err);
  }

  // Generar textos automáticos (Diagnósticos IA interna)
  const diagnosticosAuto = generarDiagnosticosAutomaticos(datosDeTrabajo, equiposCalculados, {
    deteccionFugas: resultadoDeteccionFugas,
    verificarSolar: resultadoVerificarSolar
  });

  // ---------------------------------------------------------
  // Preparación del INSERT en BD (revisiones)
  // ---------------------------------------------------------
  const datosParaInsertar = {
    // Relaciones
    caso_id: datosDeTrabajo.caso_id,
    tecnico_id: tecnicoAuth.id,

    // Metadata y Financieros
    fecha_revision: new Date().toISOString(),
    tarifa_cfe: tarifa,
    kwh_recibo_cfe: kwhRecibo,
    condicion_infraestructura: condicionInfra,
    se_midieron_cargas_menores: midieronCargasMenores,

    // Eléctricos y Físicos
    tipo_servicio: tipoServicio,
    voltaje_medido: voltaje,
    corriente_red_f1: iFase1,
    corriente_red_f2: iFase2,
    corriente_red_f3: iFase3,
    corriente_red_n: iNeutro,
    corriente_fuga_f1: corrienteFugaCalculada, // Calculada
    corriente_paneles_f1: datosDeTrabajo.corriente_paneles_f1,
    corriente_paneles_f2: datosDeTrabajo.corriente_paneles_f2,
    corriente_paneles_f3: datosDeTrabajo.corriente_paneles_f3,

    tipo_medidor: datosDeTrabajo.tipo_medidor,
    giro_medidor: datosDeTrabajo.giro_medidor,
    sello_cfe: datosDeTrabajo.sello_cfe,
    condicion_base_medidor: datosDeTrabajo.condicion_base_medidor,
    edad_instalacion: datosDeTrabajo.edad_instalacion,
    cantidad_circuitos: datosDeTrabajo.cantidad_circuitos,
    condiciones_cc: datosDeTrabajo.condiciones_cc,
    observaciones_cc: datosDeTrabajo.observaciones_cc,
    tornillos_flojos: datosDeTrabajo.tornillos_flojos,
    capacidad_vs_calibre: datosDeTrabajo.capacidad_vs_calibre,
    se_puede_apagar_todo: sePuedeApagar,

    // Solar Data
    cantidad_paneles: datosDeTrabajo.cantidad_paneles,
    watts_por_panel: datosDeTrabajo.watts_por_panel,
    paneles_antiguedad_anos: datosDeTrabajo.paneles_antiguedad_anos,

    // Diagnósticos
    diagnosticos_automaticos: diagnosticosAuto,
    causas_alto_consumo: causasLimpias,
    recomendaciones_tecnico: datosDeTrabajo.recomendaciones_tecnico,
    resultado_deteccion_fugas: resultadoDeteccionFugas,
    resultado_verificar_solar: resultadoVerificarSolar,

    // Control de PDF y Email
    cliente_email: datosDeTrabajo.cliente_email,

    // --- NUEVOS CAMPOS PARA EL PROCESO ASÍNCRONO ---
    proceso_status: 'pendiente',
    intentos_envio: 0
  };

  // INSERCIÓN DE LA REVISIÓN
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

  // INSERCIÓN DE EQUIPOS REVISADOS
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

  // Retornamos TODO lo necesario para que la función de fondo
  // no tenga que volver a calcular cosas ni consultar la DB innecesariamente.
  return {
    revisionId: newRevisionId,
    revisionData: revData,         // Datos guardados (incluye los calculados)
    equiposCalculados,             // Array de equipos con consumos
    firmaBase64: firmaBase64,      // Firma para procesar después
    datosOriginales: datosDeTrabajo // Datos crudos para referencias
  };
};

/**
 * ==================================================================
 * FASE 2: LENTA (Asíncrona - Background)
 * Genera PDF, consulta IA, envía Email y Notifica vía Push
 * ==================================================================
 */
export const generarArtefactosYNotificar = async (dataContext, tecnicoAuth) => {
  const { revisionId, revisionData, equiposCalculados, firmaBase64, datosOriginales } = dataContext;

  console.log(`[Background] Iniciando proceso pesado para revisión #${revisionId}`);

  try {
    // 1. Marcar como procesando
    await supabaseAdmin.from('revisiones')
      .update({ proceso_status: 'procesando', intentos_envio: 1 })
      .eq('id', revisionId);

    // -----------------------
    // A. Perfil del ingeniero
    // -----------------------
    let nombreIngeniero = 'Ingeniero Especialista';
    let firmaIngenieroUrl = null;

    try {
      const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('profiles')
        .select('nombre, firma_url')
        .eq('id', tecnicoAuth.id)
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

    // -----------------------
    // B. Actualización del CASO y Recuperación CLIENTE
    // -----------------------
    let casoUpdated = null;
    try {
      // Mantenemos el status 'en_curso'
      const { data: casoData, error: casoError } = await supabaseAdmin
        .from('casos')
        .update({ status: 'en_curso' })
        .eq('id', revisionData.caso_id)
        .select('id, cliente:clientes(nombre_completo, direccion_principal, email)')
        .maybeSingle();

      if (casoError) {
        console.warn('No se pudo actualizar el caso:', casoError.message);
      } else {
        casoUpdated = casoData;
      }
    } catch (err) {
      console.warn('Error actualizando caso:', err);
    }

    // Fallback: Si no obtuvimos cliente por la actualización
    if (!casoUpdated) {
      try {
        const { data: casoFetch, error: casoFetchErr } = await supabaseAdmin
          .from('casos')
          .select('id, cliente:clientes(nombre_completo, direccion_principal, email)')
          .eq('id', revisionData.caso_id)
          .maybeSingle();

        if (!casoFetchErr) casoUpdated = casoFetch;
      } catch (err) {
        console.warn('No se pudo recuperar info del caso:', err);
      }
    }

    // -----------------------
    // C. Procesamiento de FIRMA CLIENTE
    // -----------------------
    let firmaClienteUrl = null;
    if (firmaBase64) {
      try {
        // Decodificamos el base64
        const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const bufferData = Buffer.from(matches[2], 'base64');
          // Ruta ajustada a tu imagen de Supabase: reportes > firmas
          const filePath = `firmas/cliente-${revisionId}.png`;

          const publicUrl = await uploadBufferToStorage('reportes', filePath, bufferData, contentType);
          if (publicUrl) {
            firmaClienteUrl = publicUrl;
            // Actualizamos la revisión con la URL de la firma
            await supabaseAdmin.from('revisiones').update({ firma_url: firmaClienteUrl }).eq('id', revisionId);
          }
        } else {
          console.warn('Formato de firmaBase64 no reconocido.');
        }
      } catch (errFirma) {
        console.error('Error procesando firma del cliente:', errFirma);
      }
    }

    // -----------------------
    // D. CÁLCULOS AVANZADOS DE DESPERDICIO (Para el PDF)
    // -----------------------
    // Recuperamos variables necesarias
    const voltaje = revisionData.voltaje_medido || 127;
    const corrienteFuga = revisionData.corriente_fuga_f1 || 0;
    const kwhRecibo = revisionData.kwh_recibo_cfe || 0;
    const midieronCargasMenores = revisionData.se_midieron_cargas_menores;

    // 1. Fuga en Infraestructura (V * A_Fuga * 24h * 60d / 1000)
    const kwhFugaInfraestructura = (voltaje * corrienteFuga * 24 * 60) / 1000;

    // 2. Ineficiencia de Equipos (Suma total de consumo de equipos Malos o Regulares)
    let kwhIneficienciaEquipos = 0;
    equiposCalculados.forEach(eq => {
      if (eq.estado_equipo === 'Malo' || eq.estado_equipo === 'Regular') {
        kwhIneficienciaEquipos += (eq.kwh_bimestre_calculado || 0);
      }
    });

    // 3. Consumo Auditado Ajustado
    const totalKwhAuditado = equiposCalculados.reduce((acc, c) => acc + (c.kwh_bimestre_calculado || 0), 0);
    const factorHolgura = midieronCargasMenores ? 1.0 : 1.20;
    const totalAuditadoAjustado = totalKwhAuditado * factorHolgura;

    // 4. Consumo No Identificado (Diferencia vs Recibo CFE)
    let kwhNoIdentificado = kwhRecibo - totalAuditadoAjustado;
    if (kwhNoIdentificado < 0) kwhNoIdentificado = 0;

    // 5. TOTAL DESPERDICIO
    const kwhDesperdicioTotal = kwhFugaInfraestructura + kwhIneficienciaEquipos + kwhNoIdentificado;

    // Cálculos para Gráfica
    const kwhFugaReal = kwhFugaInfraestructura + kwhNoIdentificado; // Rojo
    let kwhEficiente = kwhRecibo - kwhDesperdicioTotal; // Verde
    if (kwhEficiente < 0) kwhEficiente = 0;

    // Porcentaje de impacto
    let porcentajeFuga = 0;
    if (kwhRecibo > 0) {
      porcentajeFuga = (kwhDesperdicioTotal / kwhRecibo) * 100;
    }
    const alertaFuga = porcentajeFuga >= 15;

    // -----------------------
    // E. Generación de PDF
    // -----------------------
    let pdfUrl = null;

    const datosParaPdf = {
      header: {
        id: revisionId,
        fecha_revision: revisionData.fecha_revision,
        cliente_nombre: casoUpdated?.cliente?.nombre_completo || 'Cliente',
        cliente_direccion: casoUpdated?.cliente?.direccion_principal || 'Dirección no registrada',
        cliente_email: revisionData.cliente_email || casoUpdated?.cliente?.email || '',
        tecnico_nombre: nombreIngeniero,
        firma_ingeniero_url: firmaIngenieroUrl,
        tarifa: revisionData.tarifa_cfe,
        condicion_infra: revisionData.condicion_infraestructura
      },
      mediciones: {
        ...datosOriginales, // Pasamos todos los datos crudos para visualización en tabla
        corriente_fuga_f1: corrienteFuga
      },
      finanzas: {
        kwh_recibo: kwhRecibo,
        kwh_auditado: totalAuditadoAjustado,
        kwh_desperdicio_total: kwhDesperdicioTotal,

        // Desglose Gráfica
        kwh_eficiente: kwhEficiente,
        kwh_ineficiencia: kwhIneficienciaEquipos,
        kwh_fuga_real: kwhFugaReal,

        porcentaje_desperdicio: porcentajeFuga,
        alerta_fuga: alertaFuga
      },
      desglose_desperdicio: {
        fuga_infraestructura: kwhFugaInfraestructura,
        equipos_ineficientes: kwhIneficienciaEquipos,
        consumo_no_identificado: kwhNoIdentificado
      },
      equipos: equiposCalculados,
      consumo_total_estimado: totalAuditadoAjustado,
      causas_alto_consumo: revisionData.causas_alto_consumo,
      recomendaciones_tecnico: revisionData.recomendaciones_tecnico || '',
      firma_cliente_url: firmaClienteUrl
    };

    try {
      console.log('Generando PDF...');
      const pdfBuffer = await generarPDF(datosParaPdf);

      if (pdfBuffer) {
        // Ruta ajustada a tu imagen: bucket 'reportes', carpeta 'reportes'
        const pdfPath = `reportes/reporte-revision-${revisionId}.pdf`;
        const publicPdfUrl = await uploadBufferToStorage('reportes', pdfPath, pdfBuffer, 'application/pdf');

        if (publicPdfUrl) {
          pdfUrl = publicPdfUrl;
          await supabaseAdmin.from('revisiones')
            .update({ pdf_url: pdfUrl, proceso_status: 'completado' })
            .eq('id', revisionId);
          console.log('PDF generado y subido correctamente:', pdfUrl);
        } else {
          throw new Error('No se pudo obtener URL pública del PDF subido.');
        }
      } else {
        throw new Error("Puppeteer no retornó un buffer válido.");
      }
    } catch (pdfError) {
      console.error('Error crítico en proceso de PDF:', pdfError);
      throw pdfError; // Relanzamos para caer en el catch principal y notificar error
    }

    // -----------------------
    // F. Envío de correo
    // -----------------------
    const clienteEmail = revisionData.cliente_email || casoUpdated?.cliente?.email || '';

    if (pdfUrl && clienteEmail) {
      try {
        console.log(`Preparando datos para email a ${clienteEmail}...`);

        // Unificar hallazgos manuales y automáticos
        const manuales = revisionData.causas_alto_consumo || [];
        const automaticos = revisionData.diagnosticos_automaticos || [];

        let hallazgosCombinados = [...manuales, ...automaticos];

        const listaFinalParaEmail = hallazgosCombinados
          .map(item => {
            if (typeof item === 'object' && item !== null) {
              return item.texto || item.mensaje || item.description || '';
            }
            return String(item);
          })
          .filter(texto => texto && texto.trim().length > 0)
          .filter((valor, indice, self) => self.indexOf(valor) === indice);

        await enviarReportePorEmail(
          clienteEmail,
          casoUpdated?.cliente?.nombre_completo || 'Cliente Estimado',
          pdfUrl,
          listaFinalParaEmail
        );
        console.log("Email enviado con éxito.");
      } catch (mailErr) {
        console.error('Error enviando correo:', mailErr?.message || mailErr);
        // No lanzamos error aquí para no marcar todo el proceso como fallido si solo falló el email
        // pero el PDF sí se generó. Aunque podrías decidir lo contrario.
      }
    }

    // -----------------------
    // G. Notificación PUSH al Técnico (FINAL)
    // -----------------------
    await sendNotificationToEmail(tecnicoAuth.email, {
      title: '✅ Reporte Listo',
      body: `El PDF del cliente ${casoUpdated?.cliente?.nombre_completo || ''} ha sido enviado.`,
      url: `/casos/detalle/${revisionData.caso_id}`
    });

  } catch (error) {
    console.error(`[Background] Error procesando revisión #${revisionId}:`, error);

    // Registrar error en BD
    await supabaseAdmin.from('revisiones')
      .update({
        proceso_status: 'error',
        log_error: error.message || String(error)
      })
      .eq('id', revisionId);

    /// Avisar error al técnico
    const payloadPushError = {
      title: '⚠️ Error al generar Reporte',
      body: `Hubo un fallo generando el PDF. El sistema reintentará automáticamente.`,
      url: `/casos/detalle/${revisionData.caso_id}`
    };

    // Usamos el EMAIL del técnico
    await sendNotificationToEmail(tecnicoAuth.email, payloadPushError);
  }
};