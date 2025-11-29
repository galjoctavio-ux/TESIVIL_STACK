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
  // Aseguramos conversión a float para evitar errores en cálculos
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

  // Actualizamos el dato maestro de fuga para usarlo en el resto del proceso
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

  // Lógica Solar Mejorada: Verifica si hay paneles instalados o corrientes detectadas
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
  // 2. Guardado en BD (revisiones + equipos_revisados)
  // ---------------------------------------------------------
  const datosParaInsertar = { ...datosDeTrabajo };

  // Limpiar campos temporales que no existen en la tabla 'revisiones'
  delete datosParaInsertar.voltaje_fn;
  delete datosParaInsertar.fuga_total;
  delete datosParaInsertar.amperaje_medido;
  // delete datosParaInsertar.antiguedad_paneles; // <--- OJO: Si tu columna en BD se llama 'paneles_antiguedad_anos', verifica que el frontend lo mande así.
  delete datosParaInsertar.equiposData;
  delete datosParaInsertar.caso_id;

  // Asignación de campos obligatorios y calculados
  datosParaInsertar.caso_id = datosDeTrabajo.caso_id;
  datosParaInsertar.tecnico_id = tecnicoAuth.id;
  datosParaInsertar.diagnosticos_automaticos = diagnosticosAuto;
  datosParaInsertar.fecha_revision = new Date().toISOString();
  datosParaInsertar.tarifa_cfe = tarifa;
  datosParaInsertar.kwh_recibo_cfe = kwhRecibo;
  datosParaInsertar.condicion_infraestructura = condicionInfra;
  datosParaInsertar.se_midieron_cargas_menores = midieronCargasMenores;

  // --- NUEVO: ASEGURAR GUARDADO DE DATOS MULTI-FASE Y SOLAR ---
  // Asignamos explícitamente las variables que leímos en la Parte 2
  datosParaInsertar.tipo_servicio = tipoServicio;
  datosParaInsertar.corriente_red_f2 = iFase2;
  datosParaInsertar.corriente_red_f3 = iFase3;
  // Para paneles, usamos lo que ya estaba en datosDeTrabajo o 0
  datosParaInsertar.corriente_paneles_f1 = datosDeTrabajo.corriente_paneles_f1 || 0;
  datosParaInsertar.corriente_paneles_f2 = datosDeTrabajo.corriente_paneles_f2 || 0;
  datosParaInsertar.corriente_paneles_f3 = datosDeTrabajo.corriente_paneles_f3 || 0;

  // Guardar resultados de detecciones opcionales si existen
  if (resultadoDeteccionFugas) datosParaInsertar.resultado_deteccion_fugas = resultadoDeteccionFugas;
  if (resultadoVerificarSolar) datosParaInsertar.resultado_verificar_solar = resultadoVerificarSolar;

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

  // ACTUALIZACIÓN DEL CASO Y RECUPERACIÓN DE CLIENTE
  let casoUpdated = null;
  try {
    // Mantenemos el status 'en_curso' para permitir venta posterior (Tu corrección anterior)
    const { data: casoData, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'en_curso' })
      .eq('id', datosDeTrabajo.caso_id)
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
      // Decodificamos el base64 que viene del canvas
      const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const bufferData = Buffer.from(matches[2], 'base64');
        const filePath = `firmas/revision-cliente-${newRevisionId}.png`;

        // Subimos la imagen al bucket 'reportes'
        const publicUrl = await uploadBufferToStorage('reportes', filePath, bufferData, contentType);
        if (publicUrl) {
          firmaClienteUrl = publicUrl;
          // Actualizamos la revisión con la URL de la firma
          await supabaseAdmin.from('revisiones').update({ firma_url: firmaClienteUrl }).eq('id', newRevisionId);
        }
      } else {
        console.warn('Formato de firmaBase64 no reconocido.');
      }
    } catch (errFirma) {
      console.error('Error procesando firma del cliente:', errFirma);
    }
  }

  // ---------------------------------------------------------
  // 4. Generación de PDF
  // ---------------------------------------------------------
  let pdfUrl = null;

  // CÁLCULO PARA GRÁFICA DE 3 PARTES:
  // 1. Fuga Real (Peligrosa): Infraestructura + Consumo No Identificado
  const kwhFugaReal = kwhFugaInfraestructura + kwhNoIdentificado;

  // 2. Ineficiencia (Equipos): Lo que gastan de más los equipos malos
  const kwhIneficiencia = kwhIneficienciaEquipos;

  // 3. Consumo Eficiente (Lo que sobra):
  // Si el recibo es 1000 y desperdicio total es 300, el eficiente es 700.
  let kwhEficiente = kwhRecibo - kwhDesperdicioTotal;
  if (kwhEficiente < 0) kwhEficiente = 0; // Protección por si los cálculos exceden el recibo

  // Preparamos el objeto con TODA la info para pintar el reporte
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
      kwh_auditado: totalAuditadoAjustado,
      kwh_desperdicio_total: kwhDesperdicioTotal, // Total general

      // NUEVO: Desglose para gráfica y textos
      kwh_eficiente: kwhEficiente,
      kwh_ineficiencia: kwhIneficiencia, // Equipos viejos (Naranja)
      kwh_fuga_real: kwhFugaReal,        // Cables/Fantasma (Rojo)

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
    causas_alto_consumo: causasLimpias,
    recomendaciones_tecnico: revData.recomendaciones_tecnico || '',
    firma_cliente_url: firmaClienteUrl
  };

  try {
    console.log('Generando PDF...');
    const pdfBuffer = await generarPDF(datosParaPdf);

    if (pdfBuffer) {
      // ... (el resto del código de subida se mantiene igual)
      const pdfPath = `reportes/reporte-${newRevisionId}.pdf`;
      const publicPdfUrl = await uploadBufferToStorage('reportes', pdfPath, pdfBuffer, 'application/pdf');

      if (publicPdfUrl) {
        pdfUrl = publicPdfUrl;
        await supabaseAdmin.from('revisiones').update({ pdf_url: pdfUrl }).eq('id', newRevisionId);
        console.log('PDF generado y subido correctamente:', pdfUrl);
      } else {
        console.error('No se pudo obtener URL pública del PDF subido.');
      }
    }
  } catch (pdfError) {
    console.error('Error crítico en proceso de PDF:', pdfError);
  }

  // ---------------------------------------------------------
  // 5. Envío de correo (solo si hay PDF y email)
  // ---------------------------------------------------------
  const clienteEmail = revData.cliente_email || casoUpdated?.cliente?.email || '';

  if (pdfUrl && clienteEmail) {
    try {
      console.log(`Preparando datos para email a ${clienteEmail}...`);

      // A. Recuperar listas crudas de la base de datos (pueden ser null)
      const manuales = revData.causas_alto_consumo || [];
      const automaticos = revData.diagnosticos_automaticos || [];

      // B. UNIFICACIÓN Y LIMPIEZA
      // Creamos una sola lista combinando ambas fuentes.
      let hallazgosCombinados = [
        ...manuales,
        ...automaticos
      ];

      // C. FILTRADO INTELIGENTE
      // 1. Aseguramos que cada elemento sea TEXTO (String).
      // 2. Eliminamos duplicados (Set).
      // 3. Filtramos valores vacíos.

      const listaFinalParaEmail = hallazgosCombinados
        .map(item => {
          // Si el item es un objeto complejo (ej: {id:1, texto:"..."}), intenta sacar el texto.
          if (typeof item === 'object' && item !== null) {
            return item.texto || item.mensaje || item.description || '';
          }
          // Si ya es texto, lo devolvemos tal cual.
          return String(item);
        })
        .filter(texto => texto && texto.trim().length > 0) // Quitar vacíos
        // Truco para quitar duplicados exactos:
        .filter((valor, indice, self) => self.indexOf(valor) === indice);

      // Log para depuración (ver qué estamos enviando)
      console.log('Enviando al correo los siguientes hallazgos:', listaFinalParaEmail);

      // D. Enviar el correo con la lista limpia
      await enviarReportePorEmail(
        clienteEmail,
        casoUpdated?.cliente?.nombre_completo || 'Cliente Estimado',
        pdfUrl,
        listaFinalParaEmail // Aquí va la lista limpia, sin objetos raros
      );

    } catch (mailErr) {
      console.error('Error enviando correo:', mailErr?.message || mailErr);
    }
  } else {
    if (!pdfUrl) console.warn('No se envió correo: no existe pdfUrl.');
    if (!clienteEmail) console.warn('No se envió correo: no existe clienteEmail.');
  }
};