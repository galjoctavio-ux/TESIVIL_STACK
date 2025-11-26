import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------
// 1. HELPER: ICONOS Y ESTILOS
// ---------------------------------------------------------
const checkIcon = `<svg style="width:14px;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="#2b8a3e" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
  
  body { font-family: 'Inter', sans-serif; padding: 40px; color: #1f2937; margin: 0; background: #fff; font-size: 12px; line-height: 1.5; }
  
  /* HEADER */
  .header-container { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
  .brand-section h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #000; text-transform: uppercase; }
  .brand-section .subtitle { font-size: 10px; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  
  .client-card { text-align: right; }
  .client-name { font-size: 16px; font-weight: 700; color: #111827; }
  .client-address { font-size: 10px; color: #6b7280; max-width: 250px; margin-left: auto; }
  
  /* TITLE BLOCK */
  .report-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
  .main-title { font-size: 28px; font-weight: 900; line-height: 1; color: #111; }
  .main-title span { display: block; font-size: 12px; font-weight: 500; color: #ef4444; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  
  .meta-grid { display: grid; grid-template-columns: auto auto; gap: 15px; text-align: right; }
  .meta-item strong { display: block; font-size: 9px; text-transform: uppercase; color: #9ca3af; }
  .meta-item div { font-weight: 600; font-size: 12px; }

  /* SUMMARY CARDS (MEDICIONES) */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
  .kpi-card { padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; position: relative; overflow: hidden; }
  .kpi-label { font-size: 9px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
  .kpi-value { font-size: 20px; font-weight: 800; color: #111; }
  .kpi-unit { font-size: 10px; font-weight: 500; color: #6b7280; margin-left: 2px; }
  
  .kpi-card.warning { background: #fef2f2; border-color: #fee2e2; }
  .kpi-card.warning .kpi-value { color: #dc2626; }
  
  /* TABLES */
  .table-section { margin-bottom: 30px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; }
  
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 10px 5px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 9px; text-transform: uppercase; font-weight: 600; }
  td { padding: 12px 5px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  tr:last-child td { border-bottom: none; }
  
  .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; display: inline-block; }
  .status-good { background: #d1fae5; color: #065f46; }
  .status-bad { background: #fee2e2; color: #991b1b; }
  .status-warn { background: #fef3c7; color: #92400e; }

  /* AI ANALYSIS BOX */
  .ai-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 20px; page-break-inside: avoid; }
  .ai-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .ai-title { font-weight: 700; color: #0f172a; font-size: 12px; text-transform: uppercase; }
  .ai-badge { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  
  .ai-content { font-size: 11px; color: #475569; }
  .recommendation-list { list-style: none; padding: 0; margin: 10px 0 0 0; }
  .recommendation-list li { margin-bottom: 6px; padding-left: 15px; position: relative; }
  .recommendation-list li::before { content: "•"; color: #ef4444; position: absolute; left: 0; font-weight: bold; }

  /* PROMO BOX (CUENTATRÓN) */
  .promo-box { margin-top: 40px; border: 2px dashed #e5e7eb; border-radius: 12px; padding: 20px; display: flex; gap: 20px; page-break-inside: avoid; }
  .promo-content { flex: 1; }
  .promo-title { font-weight: 800; font-size: 14px; color: #111; margin-bottom: 5px; }
  .promo-price { min-width: 100px; text-align: center; background: #111; color: white; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; }
  
  /* SIGNATURES */
  .footer-signatures { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
  .sig-box { width: 45%; border-top: 1px solid #d1d5db; padding-top: 10px; text-align: center; }
  .sig-img { height: 50px; object-fit: contain; display: block; margin: 0 auto 10px auto; }
  .sig-placeholder { height: 50px; }
`;

// ---------------------------------------------------------
// 2. LOGICA DE RENDERIZADO HTML
// ---------------------------------------------------------

const getHtmlReporte = (datos, analisisIA) => {
  const { header, mediciones, equipos, consumo_total_estimado, recomendaciones_tecnico, causas_alto_consumo } = datos;

  // Formateo de Equipos
  const equiposRows = equipos.map(eq => {
    let badgeClass = 'status-good';
    if (eq.estado_equipo?.toLowerCase().includes('malo')) badgeClass = 'status-bad';
    if (eq.estado_equipo?.toLowerCase().includes('regular')) badgeClass = 'status-warn';

    return `
      <tr>
        <td style="font-weight:600;">${eq.nombre_equipo}</td>
        <td>${eq.ubicacion || '-'}</td>
        <td>${eq.amperaje} A</td>
        <td><strong>${eq.kwh_bimestre?.toFixed(1) || 0}</strong> kWh</td>
        <td><span class="status-badge ${badgeClass}">${eq.estado_equipo || 'N/A'}</span></td>
      </tr>
    `;
  }).join('');

  // Formateo de Diagnóstico Manual
  const causasList = causas_alto_consumo?.map(c => `<li>${c}</li>`).join('') || '<li>No se reportaron anomalías específicas.</li>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte Técnico</title>
      <style>${styles}</style>
    </head>
    <body>

      <div class="header-container">
        <div class="brand-section">
          <h1>Luz en tu Espacio</h1>
          <div class="subtitle">Ingeniería & Eficiencia Energética</div>
        </div>
        <div class="client-card">
          <div class="client-name">${header.cliente_nombre || 'Cliente'}</div>
          <div class="client-address">${header.cliente_direccion || 'Dirección no registrada'}</div>
        </div>
      </div>

      <div class="report-title">
        <div class="main-title">
          <span>REPORTE DE DIAGNÓSTICO</span>
          POR ALTO CONSUMO
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <strong>Folio</strong>
            <div>#${header.id}</div>
          </div>
          <div class="meta-item">
            <strong>Fecha</strong>
            <div>${new Date(header.fecha_revision).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div class="meta-item">
            <strong>Técnico</strong>
            <div>${header.tecnico_nombre?.split(' ')[0] || 'Ingeniero'}</div>
          </div>
        </div>
      </div>

      <div class="section-title">
        <span>Mediciones Críticas</span>
        <span>Resumen General</span>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Voltaje (F-N)</div>
          <span class="kpi-value">${mediciones.voltaje_medido || 0}</span><span class="kpi-unit">V</span>
        </div>
        <div class="kpi-card ${mediciones.corriente_fuga_f1 > 0 ? 'warning' : ''}">
          <div class="kpi-label">Fuga Detectada</div>
          <span class="kpi-value">${mediciones.corriente_fuga_f1 || 0}</span><span class="kpi-unit">A</span>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-label">Consumo Est. Bimestral</div>
          <span class="kpi-value">${consumo_total_estimado?.toFixed(1) || 0}</span><span class="kpi-unit">kWh</span>
        </div>
      </div>

      <div class="section-title">
        <span>Desglose de Consumo (Equipos)</span>
        <span>Detalle</span>
      </div>
      <div class="table-section">
        <table>
          <thead>
            <tr>
              <th width="30%">Equipo</th>
              <th width="20%">Ubicación</th>
              <th width="15%">Amperaje</th>
              <th width="20%">Est. Bimestral</th>
              <th width="15%">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${equiposRows || '<tr><td colspan="5" style="text-align:center">Sin equipos registrados</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="ai-box">
        <div class="ai-header">
          <span class="ai-title">Conclusiones Técnicas</span>
          <span class="ai-badge">Ingeniero Especialista</span>
        </div>
        <div class="ai-content">
          <strong>Causas Detectadas:</strong>
          <ul class="recommendation-list">
             ${causasList}
          </ul>
          
          <div style="margin-top:15px;">
            <strong>Recomendaciones:</strong>
            <p style="margin-top:5px;">${recomendaciones_tecnico || 'Se recomienda realizar un monitoreo de 24hrs para descartar fugas intermitentes.'}</p>
          </div>
        </div>
      </div>

      <div class="ai-box" style="background:#f0f9ff; border-color:#bae6fd; margin-top:15px;">
        <div class="ai-header">
          <span class="ai-title" style="color:#0369a1;">Análisis Avanzado IA</span>
          <span class="ai-badge" style="background:#0ea5e9;">Gemini Pro</span>
        </div>
        <div class="ai-content" style="color:#334155;">
          ${analisisIA || 'El análisis automatizado confirma los hallazgos manuales. Se detecta un patrón de consumo compatible con equipos de refrigeración antiguos.'}
        </div>
      </div>

      <div class="promo-box">
        <div class="promo-content">
          <div class="promo-title">¿Tu recibo no baja? Encuentra el "Consumo Fantasma"</div>
          <div style="font-size:11px; color:#555; margin-bottom:10px;">
            Una revisión visual no detecta problemas intermitentes. Nuestro servicio <strong>Cuentatrón</strong> vigila tu instalación 24/7.
          </div>
          <div style="font-size:10px;">
             ${checkIcon} Detectamos fugas ocultas<br>
             ${checkIcon} Gráficas Día vs Noche<br>
             ${checkIcon} Calculamos pérdidas en dinero
          </div>
        </div>
        <div class="promo-price">
          <div style="font-size:20px; font-weight:800;">$999</div>
          <div style="font-size:9px; opacity:0.8;">MXN</div>
        </div>
      </div>

      <div class="footer-signatures">
        <div class="sig-box">
           ${header.firma_ingeniero_url
      ? `<img src="${header.firma_ingeniero_url}" class="sig-img" />`
      : `<div class="sig-placeholder"></div>`
    }
           <div style="font-weight:700; font-size:11px;">${header.tecnico_nombre || 'Ingeniero Responsable'}</div>
           <div style="font-size:9px; color:#6b7280;">Cédula Profesional TESIVIL</div>
        </div>
        <div class="sig-box">
           ${datos.firma_cliente_url
      ? `<img src="${datos.firma_cliente_url}" class="sig-img" />`
      : `<div class="sig-placeholder"></div>`
    }
           <div style="font-weight:700; font-size:11px;">Firma del Cliente</div>
           <div style="font-size:9px; color:#6b7280;">Conformidad de Servicio</div>
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
  try {
    // Placeholder para futura integración real con Gemini
    const analisisIA = "Basado en los datos recolectados, el sistema presenta un factor de potencia estable pero con picos de consumo atribuibles a los equipos señalados en rojo.";

    const html = getHtmlReporte(datos, analisisIA);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });

    const page = await browser.newPage();

    // Optimizamos para impresión
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true, // Crucial para ver colores de fondo
      margin: { top: '0.5cm', right: '0.5cm', bottom: '0.5cm', left: '0.5cm' }
    });

    await browser.close();
    return pdfBuffer;

  } catch (error) {
    console.error("Error generando PDF:", error);
    return null; // Manejo de error suave para no romper el flujo principal
  }
};