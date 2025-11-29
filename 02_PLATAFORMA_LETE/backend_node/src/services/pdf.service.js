import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ICONOS SVG (Para evitar las 'X' o cuadros vacíos) - SOLUCIÓN PUNTO 4
const ICONS = {
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  fire: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.246-4.004-3.5-5.5A2.5 2.5 0 0 1 5 6c0 1.5 1 2.5 3 3.5a2.5 2.5 0 0 0 0 5z"></path><path d="M12 22c5.523 0 10-4.477 10-10a10 10 0 0 0-10-10C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10z"></path></svg>`
};

// ---------------------------------------------------------
// 1. ESTILOS VISUALES (DISEÑO PREMIUM)
// ---------------------------------------------------------
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
  
  body { font-family: 'Roboto', sans-serif; padding: 40px; color: #1f2937; margin: 0; background: #fff; font-size: 12px; line-height: 1.4; }
  
  /* HEADER */
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 25px; }
  .brand h1 { font-size: 26px; font-weight: 900; margin: 0; color: #111; text-transform: uppercase; letter-spacing: -1px; }
  .brand p { font-size: 9px; color: #666; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 2px; }
  .client-info { text-align: right; }
  .client-name { font-size: 16px; font-weight: 700; color: #000; }
  .client-meta { font-size: 10px; color: #555; margin-top: 2px; }
  .tarifa-badge { background: #111; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-left: 5px; }
  
  /* ZONA B: RESUMEN FINANCIERO (GANCHO) */
  .financial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
  .fin-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
  .fin-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; }
  .fin-value { font-size: 24px; font-weight: 900; color: #111; }
  .fin-unit { font-size: 12px; font-weight: 500; color: #9ca3af; }
  
  .card-danger { background: #fef2f2; border-color: #fecaca; }
  .card-danger .fin-value { color: #dc2626; }
  .card-success { background: #f0fdf4; border-color: #bbf7d0; }
  .card-success .fin-value { color: #16a34a; }

  /* ZONA C: IA */
  .ai-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px; border-radius: 0 8px 8px 0; }
  .ai-title { font-size: 10px; font-weight: 900; color: #1e40af; text-transform: uppercase; margin-bottom: 5px; display: flex; align-items: center; gap: 5px; }
  .ai-text { font-style: italic; color: #1e3a8a; font-size: 11px; text-align: justify; }

  /* ZONA D: VISUALIZACIÓN */
  .viz-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 30px; margin-bottom: 25px; align-items: start; }
  .chart-container { text-align: center; }
  .infra-card { padding: 15px; border-radius: 8px; text-align: center; border: 1px solid transparent; }
  .infra-good { background: #ecfdf5; border-color: #10b981; color: #065f46; }
  .infra-regular { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
  .infra-bad { background: #fef2f2; border-color: #ef4444; color: #991b1b; }
  
  .tech-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
  .tech-table td { padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
  .tech-val { font-weight: 700; text-align: right; }

  /* ZONA E: TABLA EQUIPOS */
  .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px; }
  
  .main-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .main-table th { text-align: left; padding: 8px; background: #f3f4f6; color: #4b5563; font-weight: 700; text-transform: uppercase; }
  .main-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }

  /* COLORES DE FILAS - SOLUCIÓN PUNTO 2 */
  .row-malo { background-color: #fee2e2; color: #991b1b; } /* Rojo suave */
  .row-regular { background-color: #ffedd5; color: #9a3412; } /* Naranja suave */
  
  .badge { padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 800; text-transform: uppercase; }
  .b-malo { background: #fee2e2; color: #991b1b; }
  .b-regular { background: #fef3c7; color: #92400e; }
  .b-bueno { background: #d1fae5; color: #065f46; }

  /* ZONA F: TRIGGERS (VENTA) */
  .trigger-box { display: flex; align-items: center; gap: 15px; padding: 15px; border-radius: 8px; margin-top: 20px; color: white; }
  .t-solar { background: linear-gradient(135deg, #b91c1c, #7f1d1d); }
  .t-leak { background: #111; }
  .trigger-icon { font-size: 24px; }
  .trigger-content h3 { margin: 0; font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .trigger-content p { margin: 2px 0 0 0; font-size: 10px; opacity: 0.9; }

  /* TABLA DESGLOSE - SOLUCIÓN PUNTO 6 */
  .breakdown-table { width: 100%; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 20px; font-size: 10px; }
  .breakdown-table td { padding: 8px; border-bottom: 1px solid #eee; }
  .breakdown-header { background: #f3f4f6; font-weight: bold; text-transform: uppercase; }
  .breakdown-total { background: #111; color: #fff; font-weight: 900; font-size: 12px; }

  /* FOOTER & FIRMAS - SOLUCIÓN PUNTO 5 */
  .footer { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .sig-box { width: 40%; text-align: center; border-top: 1px solid #d1d5db; padding-top: 10px; position: relative; }
  .sig-img { height: 60px; object-fit: contain; display: block; margin: 0 auto 5px auto; } 
`;


// ---------------------------------------------------------
// 2. IA GENERATIVA (GEMINI PROMPT REFORZADO)
// ---------------------------------------------------------
const generarDiagnosticoIA = async (datos) => {
  const apiKey = process.env.GEMINI_API_KEY;

  // Preparamos solo los datos que le importan al "Auditor Financiero"
  const payloadIA = {
    tarifa: datos.header?.tarifa,
    condicion_infraestructura: datos.header?.condicion_infra,
    kwh_recibo: datos.finanzas?.kwh_recibo,
    kwh_desperdicio: datos.finanzas?.kwh_desperdicio,
    alerta_fuga: datos.finanzas?.alerta_fuga,
    equipos_criticos: datos.equipos?.filter(e => e.estado_equipo === 'Malo').map(e => e.nombre_equipo)
  };

  const prompt = `
    Actúa como un Auditor Energético Senior experto en finanzas.
    Analiza este JSON: ${JSON.stringify(payloadIA)}.
    
    Escribe un "Diagnóstico Ejecutivo" de máximo 60 palabras.
    
    REGLAS OBLIGATORIAS:
    1. Si 'condicion_infraestructura' es 'Malo', DEBES iniciar con: "URGENTE: Riesgo crítico de seguridad e incendio por instalación obsoleta."
    2. Si 'alerta_fuga' es true, menciona explícitamente que hay "Dinero perdido en fugas o consumo fantasma".
    3. Si la tarifa es 'DAC', menciona que están pagando sobreprecio y la solución es solar.
    4. Tono: Profesional, directo y alarmante si hay riesgo. Sin saludos.
  `;

  if (!apiKey) return "Análisis IA no disponible. Se recomienda atender los puntos rojos marcados en este reporte.";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
    });
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Revisión técnica completada.";
  } catch (error) {
    console.error("Error Gemini:", error.message);
    return "Basado en la inspección visual y mediciones, se detectaron oportunidades críticas de ahorro y seguridad.";
  }
};

// ---------------------------------------------------------
// 3. GENERADOR HTML
// ---------------------------------------------------------
const getHtmlReporte = (datos, textoIA) => {
  const { header, finanzas, equipos, mediciones } = datos;

  // A. Lógica Gráfica QuickChart (Dona)
  const chartData = {
    type: 'doughnut',
    data: {
      labels: ['Consumo Real', 'Desperdicio/Fuga'],
      datasets: [{
        data: [finanzas.kwh_ajustado, finanzas.kwh_desperdicio],
        backgroundColor: ['#22c55e', '#ef4444'], // Verde vs Rojo
        borderWidth: 0
      }]
    },
    options: {
      cutoutPercentage: 70,
      plugins: { legend: { display: false }, outlabels: { display: false } }
    }
  };
  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartData))}&w=250&h=250`;

  // LOGICA INFRAESTRUCTURA (Reemplazando Emojis por SVGs)
  let infraHtml = '';
  if (header.condicion_infra === 'Malo') {
    infraHtml = `
      <div class="infra-card infra-bad">
        ${ICONS.fire}
        <div style="font-weight:900; font-size:12px; margin-top:5px;">INSTALACIÓN DE RIESGO</div>
        <div style="font-size:9px;">Peligro de Incendio o Corto.</div>
      </div>`;
  } else if (header.condicion_infra === 'Regular') {
    infraHtml = `
      <div class="infra-card infra-regular">
        ${ICONS.warning}
        <div style="font-weight:900; font-size:12px; margin-top:5px;">MANTENIMIENTO REQUERIDO</div>
        <div style="font-size:9px;">Desgaste visible detectado.</div>
      </div>`;
  } else {
    infraHtml = `
      <div class="infra-card infra-good">
        ${ICONS.check}
        <div style="font-weight:900; font-size:12px; margin-top:5px;">INSTALACIÓN CORRECTA</div>
        <div style="font-size:9px;">Cumple estándares básicos.</div>
      </div>`;
  }

  // LOGICA TABLA EQUIPOS (Colores de filas)
  const rows = equipos.map(eq => {
    let badgeClass = 'b-bueno';
    let rowClass = ''; // Clase para pintar toda la fila

    if (eq.estado_equipo === 'Malo') {
      badgeClass = 'b-malo';
      rowClass = 'row-malo'; // Pinta rojo
    }
    if (eq.estado_equipo === 'Regular') {
      badgeClass = 'b-regular';
      rowClass = 'row-regular'; // Pinta naranja
    }

    return `
      <tr class="${rowClass}">
        <td>
          <div style="font-weight:bold;">${eq.nombre_equipo}</div>
          <div style="font-size:9px; color:#666;">${eq.nombre_personalizado || ''}</div>
        </td>
        <td style="text-align:center;"><span class="badge ${badge}">${eq.estado_equipo}</span></td>
        <td style="text-align:center;">${eq.tiempo_uso} h</td>
        <td style="text-align:right;">${eq.amperaje_medido} A</td>
        <td style="text-align:right; font-weight:bold;">${eq.kwh_bimestre_calculado?.toFixed(0)} kWh</td>
      </tr>
    `;
  }).join('');

  // SOLUCIÓN PUNTO 3: Mapeo de anomalías (evitar [object Object])
  const anomaliasHtml = (datos.causas_alto_consumo || [])
    .map(c => typeof c === 'string' ? `<li>${c}</li>` : '')
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${styles}</style></head>
    <body>

      <div class="header">
        <div class="brand">
          <h1 style="margin-bottom:5px;">LUZ EN TU ESPACIO</h1>
          <div style="font-size:9px; color:#4b5563; line-height:1.3;">
            Av. Sebastian Bach 4978, Prados Guadalupe, Zapopan, Jal.<br>
            Tel: 33 2639 5038 | contacto-lete@tesivil.com<br>
            www.tesivil.com/lete
          </div>
        </div>
        <div class="client-info">
          <div class="client-name">
            ${header.cliente_nombre} 
            <span class="tarifa-badge">TARIFA ${header.tarifa}</span>
          </div>
          <div class="client-meta">${header.cliente_direccion}</div>
          <div class="client-meta">Folio #${header.id} | ${new Date(header.fecha_revision).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="financial-grid">
        <div class="fin-card">
          <div class="fin-label">Reportado en Recibo</div>
          <div class="fin-value">${finanzas.kwh_recibo} <span class="fin-unit">kWh</span></div>
        </div>
        <div class="fin-card card-success">
          <div class="fin-label">Consumo Auditado Real</div>
          <div class="fin-value">${finanzas.kwh_ajustado.toFixed(0)} <span class="fin-unit">kWh</span></div>
        </div>
        <div class="fin-card ${finanzas.alerta_fuga ? 'card-danger' : ''}">
          <div class="fin-label">Desperdicio / Fuga</div>
          <div class="fin-value">${finanzas.kwh_desperdicio.toFixed(0)} <span class="fin-unit">kWh</span></div>
        </div>
      </div>

      <div class="ai-box">
        <div class="ai-title">⚡ Diagnóstico Ejecutivo (IA)</div>
        <div class="ai-text">"${textoIA}"</div>
      </div>

      <div class="viz-grid">
        <div class="chart-container">
          <img src="${chartUrl}" width="160" />
          <div style="font-size:9px; color:#888; margin-top:5px;">Distribución de Energía</div>
        </div>
        <div>
          ${infraHtml}
          <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
            <table class="tech-table">
              <tr><td>Voltaje de Operación</td><td class="tech-val">${mediciones.voltaje_medido} V</td></tr>
              <tr><td>Corriente de Fuga (Medición Directa)</td><td class="tech-val ${mediciones.corriente_fuga_f1 > 0.5 ? 'color:red' : ''}">${mediciones.corriente_fuga_f1} A</td></tr>
              <tr><td>Capacidad vs Calibre</td><td class="tech-val">${mediciones.capacidad_vs_calibre ? '✅ Correcto' : '❌ Incorrecto'}</td></tr>
            </table>
          </div>
        </div>
      </div>

      <div class="section-title">Desglose de Consumo por Equipo</div>
      <table class="main-table">
        <thead>
          <tr>
            <th width="40%">Equipo</th>
            <th width="15%" style="text-align:center;">Estado</th>
            <th width="15%" style="text-align:center;">Uso Diario</th>
            <th width="15%" style="text-align:right;">Amperaje</th>
            <th width="15%" style="text-align:right;">Bimestral</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      ${header.tarifa === 'DAC' ? `
        <div class="trigger-box t-solar">
          <div class="trigger-icon">☀️</div>
          <div class="trigger-content">
            <h3>Alerta: Tarifa DAC Detectada</h3>
            <p>Estás pagando el precio más alto de energía en México. La única forma efectiva de salir y congelar el costo es instalar Paneles Solares.</p>
          </div>
        </div>` : ''
    }

      ${finanzas.alerta_fuga ? `
        <div class="trigger-box t-leak">
          <div class="trigger-icon">👻</div>
          <div class="trigger-content">
            <h3>Alerta: Consumo Fantasma Crítico</h3>
            <p>Detectamos una diferencia mayor al 15% entre lo que usas y lo que pagas. Recomendamos instalar el monitor "Cuentatrón" 24/7 para hallar la fuga.</p>
          </div>
        </div>` : ''
    }

    <div class="section-title" style="margin-top:20px;">Observaciones del Ingeniero</div>
      <div style="background:#f9fafb; border:1px solid #e5e7eb; padding:12px; border-radius:8px; margin-bottom:20px;">
        ${datos.causas_alto_consumo?.length > 0 ? `
          <div style="font-weight:700; font-size:10px; margin-bottom:4px;">Anomalías Específicas:</div>
          <ul style="margin:0 0 10px 0; padding-left:20px; font-size:10px; color:#4b5563;">
            ${datos.causas_alto_consumo.map(c => `<li>${c}</li>`).join('')}
          </ul>
        ` : ''}
        
        <div style="font-weight:700; font-size:10px; margin-bottom:2px;">Dictamen Técnico y Recomendaciones:</div>
        <p style="margin:0; font-size:10px; color:#374151; white-space:pre-wrap;">
          ${datos.recomendaciones_tecnico || 'Se sugiere proceder con las correcciones marcadas en este reporte.'}
        </p>
      </div>

      ${finanzas.kwh_desperdicio > 0 ? `
      <div class="section-title" style="margin-top:20px; color:#b91c1c;">Análisis de Pérdidas de Energía</div>
      <table class="breakdown-table">
        <tr class="breakdown-header">
          <td>Origen de la Pérdida</td>
          <td style="text-align:right;">Impacto Bimestral</td>
        </tr>
        <tr>
          <td>Fuga en Infraestructura (Cableado/Aislamiento)</td>
          <td style="text-align:right;">${desglose_desperdicio?.fuga_infraestructura?.toFixed(1) || 0} kWh</td>
        </tr>
        <tr>
          <td>Ineficiencia por Equipos (Regular/Malo)</td>
          <td style="text-align:right;">${desglose_desperdicio?.equipos_ineficientes?.toFixed(1) || 0} kWh</td>
        </tr>
        <tr>
          <td>Consumo Fantasma / No Identificado (Diferencia vs CFE)</td>
          <td style="text-align:right;">${desglose_desperdicio?.consumo_no_identificado?.toFixed(1) || 0} kWh</td>
        </tr>
        <tr class="breakdown-total">
          <td>TOTAL DESPERDICIO</td>
          <td style="text-align:right;">${finanzas.kwh_desperdicio.toFixed(1)} kWh</td>
        </tr>
      </table>
      ` : ''}

      <div class="footer">
        <div class="sig-box">
          ${header.firma_ingeniero_url ? `<img src="${header.firma_ingeniero_url}" class="sig-img"/>` : '<div style="height:50px;"></div>'}
          <div style="font-weight:bold; font-size:10px; margin-top:5px;">${header.tecnico_nombre}</div>
          <div style="font-size:9px; color:#666;">Ingeniero Auditor</div>
        </div>
        <div class="sig-box">
          ${datos.firma_cliente_url ? `<img src="${datos.firma_cliente_url}" class="sig-img"/>` : '<div style="height:50px;"></div>'}
          <div style="font-weight:bold; font-size:10px; margin-top:5px;">Firma de Conformidad</div>
          <div style="font-size:9px; color:#666;">Cliente / Representante</div>
        </div>
      </div>

      <div style="margin-top:30px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:8px; color:#9ca3af; text-align:justify;">
        <strong>AVISO LEGAL:</strong> Este documento es un diagnóstico técnico basado en las condiciones visibles y mediciones puntuales realizadas durante la visita. Los cálculos de consumo, desperdicio y ahorro son estimaciones de ingeniería con fines informativos y pueden variar según los hábitos de uso del usuario. Este reporte no constituye una garantía de facturación futura ante CFE ni responsabiliza a <em>Luz en tu Espacio</em> por vicios ocultos en la infraestructura eléctrica o cambios posteriores en la instalación.
      </div>

    </body>
    </html>
  `;
};

// ---------------------------------------------------------
// 4. FUNCIÓN PRINCIPAL (EXPORT)
// ---------------------------------------------------------
export const generarPDF = async (datos) => {
  try {
    console.log('[PDF Service] Solicitando análisis a Gemini...');
    const textoIA = await generarDiagnosticoIA(datos);
    const html = getHtmlReporte(datos, textoIA);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.8cm', right: '0.8cm', bottom: '0.8cm', left: '0.8cm' }
    });

    await browser.close();
    return pdfBuffer;

  } catch (error) {
    console.error("Error generando PDF:", error);
    return null;
  }
};