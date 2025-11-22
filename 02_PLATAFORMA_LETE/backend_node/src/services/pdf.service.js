import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------
// 1. GENERACIÓN DE DIAGNÓSTICO CON IA (GEMINI 2.5 FLASH)
// ---------------------------------------------------------
const generarDiagnosticoIA = async (datosRevision) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY no encontrada.");
    return "IA no configurada en el sistema.";
  }

  // Usamos el modelo 2.5 Flash
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Contexto resumido para la IA
  const datosParaIA = {
    servicio: datosRevision.mediciones?.tipo_servicio,
    fugas: datosRevision.mediciones?.corriente_fuga_f1 + " A",
    consumo_bimestral: datosRevision.consumo_total_estimado + " kWh",
    equipos_altos: datosRevision.equipos?.slice(0, 3).map(e => e.nombre_equipo).join(', '),
    hallazgos: {
      sello: datosRevision.mediciones?.sello_cfe ? 'Si' : 'No',
      tornillos_flojos: datosRevision.mediciones?.tornillos_flojos ? 'Si' : 'No'
    }
  };

  const prompt = `
    Eres un Ingeniero Eléctrico de la empresa TESIVIL.
    Analiza estos datos: ${JSON.stringify(datosParaIA)}.
    Escribe un 'Diagnóstico Ejecutivo' (Máx 50 palabras).
    1. Si hay fugas o tornillos flojos, advierte del riesgo.
    2. Si el consumo es alto, menciónalo.
    3. Sé directo y profesional. Texto plano.
  `;

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
    });

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    return 'Diagnóstico técnico completado. Revise la tabla de mediciones.';
  } catch (error) {
    console.error('Error Gemini:', error.message);
    return 'Revisión técnica realizada. Datos numéricos anexos.';
  }
};

// ---------------------------------------------------------
// 2. CONSTRUCCIÓN DEL HTML DEL REPORTE
// ---------------------------------------------------------
const getHtmlPlantilla = (datos, diagnosticoIA) => {
  const formatNum = (num) => parseFloat(num || 0).toFixed(1);
  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { return d; }
  };

  // Clases CSS condicionales
  const valBueno = 'val-bueno';
  const valMalo = 'val-malo';

  // TABLA DE EQUIPOS
  let equiposHtml = '';
  if (datos.equipos && datos.equipos.length > 0) {
    datos.equipos.forEach(eq => {
      const estado = eq.estado_equipo || '';
      equiposHtml += `
            <tr class="equipo-estado-${estado}">
                <td>${eq.nombre_equipo}</td>
                <td>${eq.ubicacion || ''}</td>
                <td align="center">${formatNum(eq.amperaje)} A</td>
                <td align="center"><strong>${formatNum(eq.kwh_bimestre)}</strong></td>
                <td align="center">${estado}</td>
            </tr>`;
    });
    // Fila de Total
    equiposHtml += `
        <tr class="total-row">
            <td colspan="3" align="right">Consumo Bimestral Estimado (Carga Conectada):</td>
            <td align="center">${formatNum(datos.consumo_total_estimado)} kWh</td>
            <td></td>
        </tr>`;
  } else {
    equiposHtml = '<tr><td colspan="5" align="center" style="padding:15px;">No se registraron equipos significativos.</td></tr>';
  }

  // CAUSAS
  let causasHtml = (datos.causas_alto_consumo || []).map(c => `<li>${c}</li>`).join('') || '<li>No se detectaron causas críticas evidentes.</li>';

  // LOGO NUEVO
  const logoUrl = "https://www.tesivil.com/logo_LETE.png";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte TESIVIL</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        @page { margin: 25px 40px; }
        body { font-family: 'Roboto', sans-serif; color: #333; font-size: 11px; line-height: 1.4; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #004085; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { height: 60px; object-fit: contain; }
        .report-meta { text-align: right; }
        .report-title { font-size: 16px; font-weight: bold; color: #004085; margin: 0 0 5px 0; text-transform: uppercase; }
        .report-folio { font-size: 12px; color: #666; }
        
        /* Cajas Informativas */
        .info-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .info-box { flex: 1; background: #f8f9fa; border-left: 4px solid #004085; padding: 12px; border-radius: 4px; }
        .lbl { font-size: 9px; text-transform: uppercase; color: #004085; font-weight: bold; margin-bottom: 2px; }
        .val { font-size: 12px; margin-bottom: 6px; }

        /* Títulos */
        .section-header { background: #004085; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px; margin-top: 20px; border-radius: 4px 4px 0 0; }
        
        /* Tablas */
        table { width: 100%; border-collapse: collapse; }
        th { background: #e9ecef; padding: 8px; text-align: left; font-size: 10px; font-weight: bold; border-bottom: 2px solid #dee2e6; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
        
        /* Colores */
        .val-bueno { color: #28a745; font-weight: bold; }
        .val-malo { color: #dc3545; font-weight: bold; }
        .equipo-estado-Malo { background: #ffebee; }
        .total-row { background: #e3f2fd; font-weight: bold; }

        /* IA Box */
        .ia-box { background: #e7f1ff; border: 1px solid #b8daff; padding: 15px; border-radius: 6px; position: relative; margin-bottom: 15px; }
        .ia-badge { position: absolute; top: -10px; right: 15px; background: linear-gradient(90deg, #004085, #007bff); color: white; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: bold; }
        .ia-content { font-style: italic; color: #333; font-size: 12px; text-align: justify; }

        /* CUENTATRON (UPSELL) - Usando Emojis para evitar imágenes rotas */
        .promo-container { margin-top: 25px; border: 2px solid #ffc107; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; }
        .promo-head { background: #343a40; color: #ffc107; padding: 10px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
        .promo-body { padding: 15px; display: flex; gap: 15px; }
        .promo-text { flex: 2; font-size: 11px; color: #444; text-align: justify; }
        .promo-cta { flex: 1; background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .feature-list { list-style: none; padding: 0; margin: 10px 0; }
        .feature-list li { margin-bottom: 5px; }
        .btn-promo { background: #d32f2f; color: white; text-decoration: none; padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 11px; display: inline-block; margin-top: 5px; }

        /* Firmas */
        .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { width: 45%; text-align: center; }
        .sig-line { border-top: 1px solid #999; margin-top: 10px; padding-top: 5px; }
        .sig-img { max-height: 70px; display: block; margin: 0 auto; }
        .sig-placeholder { height: 70px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 10px; border: 1px dashed #eee; }
      </style>
    </head>
    <body>

      <div class="header">
        <img src="${logoUrl}" class="logo" alt="LETE Logo">
        <div class="report-meta">
            <div class="report-title">REPORTE DE DIAGNÓSTICO<br>POR ALTO CONSUMO</div>
            <div class="report-folio">Folio: #${datos.header?.id}</div>
            <div class="report-folio">Fecha: ${formatDate(datos.header?.fecha_revision)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
            <div class="lbl">CLIENTE</div>
            <div class="val"><strong>${datos.header?.cliente_nombre}</strong></div>
            <div class="val">${datos.header?.cliente_direccion}</div>
        </div>
        <div class="info-box">
            <div class="lbl">INGENIERO ASIGNADO</div>
            <div class="val" style="font-size: 14px;"><strong>${datos.header?.tecnico_nombre}</strong></div>
            <div class="val">Especialista en Eficiencia Energética</div>
        </div>
      </div>

      <div class="ia-box">
         <div class="ia-badge">ANÁLISIS GEMINI AI</div>
         <div class="ia-content">"${diagnosticoIA}"</div>
      </div>

      <table style="margin-top: 10px;">
        <tr>
            <td width="50%" style="vertical-align: top; padding-right: 10px; border: none;">
                <div class="section-header" style="margin-top: 0;">Instalación Eléctrica</div>
                <table>
                    <tr><td>Servicio</td><td>${datos.mediciones?.tipo_servicio || 'N/A'}</td></tr>
                    <tr><td>Sello CFE</td><td class="${datos.mediciones?.sello_cfe ? valBueno : valMalo}">${datos.mediciones?.sello_cfe ? 'Presente' : 'Ausente'}</td></tr>
                    <tr><td>Conexiones</td><td class="${datos.mediciones?.tornillos_flojos ? valMalo : valBueno}">${datos.mediciones?.tornillos_flojos ? 'Flojas ⚠️' : 'Correctas'}</td></tr>
                    <tr><td>Cableado</td><td class="${datos.mediciones?.capacidad_vs_calibre ? valBueno : valMalo}">${datos.mediciones?.capacidad_vs_calibre ? 'Adecuado' : 'Inadecuado ⚠️'}</td></tr>
                </table>
            </td>
            <td width="50%" style="vertical-align: top; padding-left: 10px; border: none;">
                 <div class="section-header" style="margin-top: 0;">Mediciones Críticas</div>
                 <table>
                    <tr><td>Voltaje (F-N)</td><td><strong>${formatNum(datos.mediciones?.voltaje_medido)} V</strong></td></tr>
                    <tr><td>Amp. Instantáneo</td><td>${formatNum(datos.mediciones?.corriente_red_f1)} A</td></tr>
                    <tr><td>Fuga Detectada</td><td class="${datos.mediciones?.corriente_fuga_f1 > 0.1 ? valMalo : valBueno}">${formatNum(datos.mediciones?.corriente_fuga_f1)} A</td></tr>
                 </table>
            </td>
        </tr>
      </table>

      <div class="section-header">Desglose de Consumo Estimado (Top Consumidores)</div>
      <table>
        <thead>
            <tr>
                <th>Equipo</th> <th>Ubicación</th> <th align="center">Amp.</th> <th align="center">kWh/Bimestre</th> <th align="center">Estado</th>
            </tr>
        </thead>
        <tbody>${equiposHtml}</tbody>
      </table>
      <div style="font-size: 9px; color: #666; margin-top: 2px;">* Cálculo estimado basado en amperaje medido y horas de uso reportadas.</div>

      <div class="section-header">Conclusiones del Ingeniero</div>
      <div style="padding: 10px;">
        <strong>Causas Detectadas:</strong>
        <ul style="margin-top: 5px;">${causasHtml}</ul>
        
        <strong>Recomendaciones Técnicas:</strong>
        <p style="background: #f1f3f5; padding: 10px; border-left: 4px solid #ced4da; margin-top: 5px; white-space: pre-line;">
            ${datos.recomendaciones_tecnico || 'Sin recomendaciones específicas.'}
        </p>
      </div>

      <div class="promo-container">
         <div class="promo-head">
            <span>📉 ¿Tu recibo no baja? Encuentra el "Consumo Fantasma"</span>
            <span style="font-size:10px; background:black; padding:3px 6px; border-radius:4px;">SERVICIO PREMIUM</span>
         </div>
         <div class="promo-body">
            <div class="promo-text">
                Una revisión visual no ve problemas intermitentes (bombas que se pegan de noche, refris que nunca cortan). 
                <strong>El servicio Cuentatrón (Monitoreo 7 Días)</strong> instala equipos de ingeniería para vigilar tu casa 24/7.
                <ul class="feature-list">
                    <li>✅ Detectamos fugas ocultas a tierra.</li>
                    <li>✅ Gráficas de consumo real Día vs Noche.</li>
                    <li>✅ Calculamos cuánto dinero pierdes al bimestre.</li>
                </ul>
            </div>
            <div class="promo-cta">
                <div style="color:#d32f2f; font-weight:bold; font-size:16px;">$999 MXN</div>
                <div style="font-size:9px; margin-bottom:8px;">(50% Anticipo - 50% Resultado)</div>
                <a href="https://www.tesivil.com/cuentatron/diagnostico" class="btn-promo">QUIERO MI DIAGNÓSTICO</a>
                <div style="font-size:9px; margin-top:6px; color:#666;">🛡️ Garantía de Reembolso</div>
            </div>
         </div>
      </div>

      <div class="signatures">
        <div class="sig-block">
            ${datos.header?.firma_ingeniero_url
      ? `<img src="${datos.header.firma_ingeniero_url}" class="sig-img">`
      : `<div class="sig-placeholder">Sin firma digital</div>`
    }
            <div class="sig-line"><strong>${datos.header?.tecnico_nombre}</strong><br><span style="font-size:10px; color:#666;">Ingeniero Responsable (Cédula TESIVIL)</span></div>
        </div>

        <div class="sig-block">
             ${datos.firma_cliente_url
      ? `<img src="${datos.firma_cliente_url}" class="sig-img">`
      : (datos.firma_base64
        ? `<img src="${datos.firma_base64}" class="sig-img">`
        : `<div class="sig-placeholder">Firma pendiente</div>`)
    }
            <div class="sig-line"><strong>Firma del Cliente</strong><br><span style="font-size:10px; color:#666;">Conformidad de Visita Técnica</span></div>
        </div>
      </div>

    </body>
    </html>
  `;
};

// ---------------------------------------------------------
// 3. FUNCIÓN PRINCIPAL DE GENERACIÓN
// ---------------------------------------------------------
export const generarPDF = async (datos) => {
  console.log('[PDF Service] Generando reporte profesional...');

  const diagnosticoIA = await generarDiagnosticoIA(datos);
  const html = getHtmlPlantilla(datos, diagnosticoIA);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  });

  await browser.close();
  return pdfBuffer;
};