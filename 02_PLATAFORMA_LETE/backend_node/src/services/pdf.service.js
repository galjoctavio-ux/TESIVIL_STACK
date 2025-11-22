import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------
// 1. GENERACIÓN DE DIAGNÓSTICO AVANZADO (GEMINI 1.5 PRO)
// ---------------------------------------------------------
const generarDiagnosticoIA = async (datosRevision) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "IA no configurada en el sistema.";

  // CAMBIO A VERSIÓN PRO PARA MEJOR RAZONAMIENTO
  const model = 'gemini-2.5-pro';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Datos enriquecidos para el prompt
  const datosParaIA = {
    tipo_servicio: datosRevision.mediciones?.tipo_servicio,
    voltaje: datosRevision.mediciones?.voltaje_medido + " V",
    fuga_tierra: datosRevision.mediciones?.corriente_fuga_f1 + " A",
    consumo_bimestral_estimado: datosRevision.consumo_total_estimado + " kWh",
    riesgos_seguridad: {
      falta_tierra: datosRevision.mediciones?.sello_cfe ? false : true, // Asumiendo correlación
      conexiones_flojas: datosRevision.mediciones?.tornillos_flojos,
      cableado_inadecuado: !datosRevision.mediciones?.capacidad_vs_calibre
    },
    top_equipos_consumo: datosRevision.equipos?.slice(0, 3).map(e => `${e.nombre_equipo} (${e.kwh_bimestre} kWh/bi)`).join(', '),
  };

  const prompt = `
    Eres un Consultor Senior en Eficiencia Energética de 'Luz en tu Espacio' (LETE).
    Analiza los siguientes datos técnicos de una visita residencial: ${JSON.stringify(datosParaIA)}.

    Escribe un 'Diagnóstico Ejecutivo' avanzado y persuasivo para el cliente.
    
    Pautas de redacción:
    1. NO saludes ("Hola", "Estimado"). Ve directo al grano.
    2. Si hay fugas (>0.1A) o riesgos (cables inadecuados, tornillos flojos), priorízalos con tono de urgencia moderada.
    3. Analiza si el consumo bimestral es alto (considera >400 kWh como alto para casa promedio).
    4. Menciona específicamente qué equipo está impactando más la factura.
    5. Usa un tono profesional, técnico pero comprensible.
    6. Extensión: 80 a 100 palabras.
  `;

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600 }
    });

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    return 'El análisis de IA no pudo completarse. Por favor revise las tablas de medición manuales a continuación.';
  } catch (error) {
    console.error('Error Gemini Pro:', error.message);
    return 'Diagnóstico no disponible en este momento.';
  }
};

// ---------------------------------------------------------
// 2. CONSTRUCCIÓN DEL HTML (SVGs en lugar de Emojis)
// ---------------------------------------------------------
const getHtmlPlantilla = (datos, diagnosticoIA) => {
  const formatNum = (num) => parseFloat(num || 0).toFixed(1);
  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { return d; }
  };

  const valBueno = 'val-bueno';
  const valMalo = 'val-malo';

  // Iconos SVG (Para evitar las X por falta de fuentes)
  const iconCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const iconAlert = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  const iconShield = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;

  // Tabla Equipos
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
    equiposHtml += `
        <tr class="total-row">
            <td colspan="3" align="right">Consumo Bimestral Estimado:</td>
            <td align="center">${formatNum(datos.consumo_total_estimado)} kWh</td>
            <td></td>
        </tr>`;
  } else {
    equiposHtml = '<tr><td colspan="5" align="center" style="padding:15px;">Sin equipos registrados.</td></tr>';
  }

  let causasHtml = (datos.causas_alto_consumo || []).map(c => `<li>${c}</li>`).join('') || '<li>Sin causas evidentes.</li>';

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
        
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #004085; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { height: 60px; object-fit: contain; }
        .report-meta { text-align: right; }
        .report-title { font-size: 16px; font-weight: bold; color: #004085; margin: 0 0 5px 0; text-transform: uppercase; }
        .report-folio { font-size: 12px; color: #666; }
        
        .info-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .info-box { flex: 1; background: #f8f9fa; border-left: 4px solid #004085; padding: 12px; border-radius: 4px; }
        .lbl { font-size: 9px; text-transform: uppercase; color: #004085; font-weight: bold; margin-bottom: 2px; }
        .val { font-size: 12px; margin-bottom: 6px; }

        .section-header { background: #004085; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px; margin-top: 20px; border-radius: 4px 4px 0 0; }
        
        table { width: 100%; border-collapse: collapse; }
        th { background: #e9ecef; padding: 8px; text-align: left; font-size: 10px; font-weight: bold; border-bottom: 2px solid #dee2e6; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
        
        .val-bueno { color: #28a745; font-weight: bold; }
        .val-malo { color: #dc3545; font-weight: bold; }
        .equipo-estado-Malo { background: #ffebee; }
        .total-row { background: #e3f2fd; font-weight: bold; }

        .ia-box { background: #e7f1ff; border: 1px solid #b8daff; padding: 15px; border-radius: 6px; position: relative; margin-bottom: 15px; }
        .ia-badge { position: absolute; top: -10px; right: 15px; background: linear-gradient(90deg, #004085, #007bff); color: white; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: bold; }
        .ia-content { font-style: italic; color: #333; font-size: 11px; text-align: justify; white-space: pre-line; }

        /* CUENTATRON (UPSELL) */
        .promo-container { margin-top: 25px; border: 2px solid #ffc107; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; }
        .promo-head { background: #343a40; color: #ffc107; padding: 10px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
        .promo-body { padding: 15px; display: flex; gap: 15px; }
        .promo-text { flex: 2; font-size: 11px; color: #444; text-align: justify; }
        .promo-cta { flex: 1; background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .feature-list { list-style: none; padding: 0; margin: 10px 0; }
        .feature-list li { margin-bottom: 5px; display: flex; align-items: center; gap: 5px; }
        .btn-promo { background: #d32f2f; color: white; text-decoration: none; padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 11px; display: inline-block; margin-top: 5px; }

        .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { width: 45%; text-align: center; }
        .sig-line { border-top: 1px solid #999; margin-top: 10px; padding-top: 5px; }
        .sig-img { max-height: 70px; display: block; margin: 0 auto; }
        .sig-placeholder { height: 70px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 10px; border: 1px dashed #eee; }
      </style>
    </head>
    <body>

      <div class="header">
        <img src="https://www.tesivil.com/logo_LETE.png" class="logo" alt="LETE Logo">
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
            <div class="val" style="font-size: 13px;"><strong>${datos.header?.tecnico_nombre}</strong></div>
            <div class="val">Especialista en Eficiencia Energética</div>
        </div>
      </div>

      <div class="ia-box">
         <div class="ia-badge">ANÁLISIS AVANZADO (GEMINI PRO)</div>
         <div class="ia-content">${diagnosticoIA}</div>
      </div>

      <table style="margin-top: 10px;">
        <tr>
            <td width="50%" style="vertical-align: top; padding-right: 10px; border: none;">
                <div class="section-header" style="margin-top: 0;">Instalación Eléctrica</div>
                <table>
                    <tr><td>Servicio</td><td>${datos.mediciones?.tipo_servicio || 'N/A'}</td></tr>
                    <tr><td>Sello CFE</td><td class="${datos.mediciones?.sello_cfe ? valBueno : valMalo}">${datos.mediciones?.sello_cfe ? 'Presente' : 'Ausente'}</td></tr>
                    <tr><td>Conexiones</td><td class="${datos.mediciones?.tornillos_flojos ? valMalo : valBueno}">${datos.mediciones?.tornillos_flojos ? 'Flojas ' + iconAlert : 'Correctas ' + iconCheck}</td></tr>
                    <tr><td>Cableado</td><td class="${datos.mediciones?.capacidad_vs_calibre ? valBueno : valMalo}">${datos.mediciones?.capacidad_vs_calibre ? 'Adecuado ' + iconCheck : 'Inadecuado ' + iconAlert}</td></tr>
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
                Una revisión visual no ve problemas intermitentes. <strong>El servicio Cuentatrón</strong> instala equipos de ingeniería para vigilar tu casa 24/7.
                <ul class="feature-list">
                    <li>${iconCheck} Detectamos fugas ocultas a tierra.</li>
                    <li>${iconCheck} Gráficas de consumo real Día vs Noche.</li>
                    <li>${iconCheck} Calculamos pérdidas en dinero.</li>
                </ul>
            </div>
            <div class="promo-cta">
                <div style="color:#d32f2f; font-weight:bold; font-size:16px;">$999 MXN</div>
                <div style="font-size:9px; margin-bottom:8px;">(50% Anticipo - 50% Resultado)</div>
                <a href="https://www.tesivil.com/cuentatron/diagnostico" class="btn-promo">QUIERO MI DIAGNÓSTICO</a>
                <div style="font-size:9px; margin-top:6px; color:#666; display:flex; align-items:center; justify-content:center; gap:2px;">${iconShield} Garantía de Reembolso</div>
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
      : `<div class="sig-placeholder">Firma pendiente</div>`
    }
            <div class="sig-line"><strong>Firma del Cliente</strong><br><span style="font-size:10px; color:#666;">Conformidad de Visita Técnica</span></div>
        </div>
      </div>

    </body>
    </html>
  `;
};

// ---------------------------------------------------------
// 3. FUNCIÓN PRINCIPAL
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