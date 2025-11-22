import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const generarDiagnosticoIA = async (datosRevision) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "IA no configurada.";

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Preparar datos para el prompt (seguro ante nulos)
  const datosParaIA = {
    servicio: datosRevision.mediciones?.tipo_servicio || 'Desconocido',
    hallazgos_clave: {
      sello_cfe: datosRevision.mediciones?.sello_cfe || false,
      tornillos_flojos: datosRevision.mediciones?.tornillos_flojos || false,
      capacidad_vs_calibre: datosRevision.mediciones?.capacidad_vs_calibre || true,
    },
    mediciones_fuga: {
      fuga_f1: datosRevision.mediciones?.corriente_fuga_f1 || 0,
    },
    equipos_mal_estado: datosRevision.equipos ? datosRevision.equipos.filter(eq => eq.estado_equipo === 'Malo').length : 0,
    causas_detectadas: datosRevision.causas_alto_consumo || [],
    recomendaciones_tecnico: datosRevision.recomendaciones_tecnico || ''
  };

  const prompt = `Analiza los siguientes datos JSON de una revisión eléctrica: ${JSON.stringify(datosParaIA)}. Redacta un párrafo de 'Diagnóstico Ejecutivo' profesional, breve (max 60 palabras) y tranquilizador para el cliente. Concluye positivamente. Texto plano.`;

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
    });

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    return 'Revisión técnica realizada correctamente.';
  } catch (error) {
    console.error('Error Gemini:', error.message);
    return 'Revisión técnica realizada correctamente.';
  }
};

const getHtmlPlantilla = (datos, diagnosticoIA) => {
  // Helpers para formateo
  const formatNum = (num) => parseFloat(num || 0).toFixed(1);
  const formatDate = (dateStr) => {
      try { return new Date(dateStr).toLocaleDateString('es-MX'); } catch(e) { return dateStr; }
  };
  
  // Lógica de clases CSS condicionales
  const valBueno = 'val-bueno';
  const valMalo = 'val-malo';
  
  const selloCfeClass = datos.mediciones?.sello_cfe ? valBueno : valMalo;
  const selloCfeText = datos.mediciones?.sello_cfe ? 'Sí' : 'No';
  
  const tornillosClass = datos.mediciones?.tornillos_flojos ? valMalo : valBueno;
  const tornillosText = datos.mediciones?.tornillos_flojos ? '¡Sí! (Riesgo Detectado)' : 'No (Correcto)';
  
  const capacidadClass = datos.mediciones?.capacidad_vs_calibre ? valBueno : valMalo;
  const capacidadText = datos.mediciones?.capacidad_vs_calibre ? 'Correcto' : '¡Incorrecto! (Riesgo de Incendio)';

  // Filas de equipos
  let equiposHtml = '';
  if (datos.equipos && datos.equipos.length > 0) {
      datos.equipos.forEach(eq => {
          const estado = eq.estado_equipo || '';
          equiposHtml += `
            <tr class="equipo-estado-${estado}">
                <td>${eq.nombre_equipo || ''}</td>
                <td>${eq.ubicacion || eq.nombre_personalizado || ''}</td>
                <td>${formatNum(eq.amperaje || eq.amperaje_medido)} A</td>
                <td>${estado}</td>
            </tr>`;
      });
  }

  // Causas
  let causasHtml = '';
  if (datos.causas_alto_consumo && datos.causas_alto_consumo.length > 0) {
      datos.causas_alto_consumo.forEach(c => causasHtml += `<li>${c}</li>`);
  } else {
      causasHtml = '<li>No se detectaron causas críticas específicas.</li>';
  }

  // Fases adicionales
  let fasesHtml = '';
  const tipoServicio = datos.mediciones?.tipo_servicio || '';
  if (tipoServicio !== 'Monofásico') {
      fasesHtml += `<tr><td class="lbl">Corriente Red F2</td><td class="val">${formatNum(datos.mediciones?.corriente_red_f2)} A</td></tr>`;
  }
  if (tipoServicio.includes('Trifásico')) {
      fasesHtml += `<tr><td class="lbl">Corriente Red F3</td><td class="val">${formatNum(datos.mediciones?.corriente_red_f3)} A</td></tr>`;
  }

  // Solares
  let solaresHtml = '';
  if (datos.mediciones?.cantidad_paneles > 0) {
      solaresHtml = `
        <div class="section-header">Análisis de Paneles Solares</div>
        <table class="items-table hallazgos-table">
            <tr><td class="lbl">Cantidad de Paneles</td><td class="val">${datos.mediciones.cantidad_paneles}</td></tr>
            <tr><td class="lbl">Watts por Panel</td><td class="val">${datos.mediciones.watts_por_panel} W</td></tr>
            <tr><td class="lbl">Antigüedad</td><td class="val">${datos.mediciones.paneles_antiguedad_anos} años</td></tr>
        </table>`;
  }

  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
        @page { margin: 25px; }
        body { font-family: 'Roboto', sans-serif; color: #444; font-size: 12px; line-height: 1.5; }
        .header-table { width: 100%; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 25px; }
        .logo-img { max-width: 180px; max-height: 60px; }
        .empresa-info { text-align: right; font-size: 10px; color: #6c757d; }
        .empresa-info strong { font-size: 12px; color: #0056b3; }
        .cliente-box { border: 1px solid #dee2e6; border-left: 5px solid #0056b3; padding: 15px; margin-bottom: 25px; border-radius: 4px; background-color: #f8f9fa; }
        .cliente-label { font-weight: bold; color: #0056b3; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
        .cliente-dato { font-size: 12px; margin-bottom: 5px; }
        .section-header { background-color: #0056b3; color: white; padding: 8px 12px; font-weight: bold; font-size: 12px; margin-top: 20px; border-radius: 4px 4px 0 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
        .items-table td { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        .items-table th { background-color: #f8f9fa; color: #0056b3; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; padding: 10px 15px; text-align: left; }
        .items-table tr:nth-child(even) { background-color: #fbfbfb; }
        .items-table tr:last-child td { border-bottom: none; }
        .firma-box { border: 1px dashed #ccc; padding: 10px; width: 250px; height: 120px; text-align: center; display: inline-block; margin: 10px; }
        .firma-img { max-width: 100%; max-height: 80px; object-fit: contain; }
        .firma-label { font-size: 10px; color: #555; margin-top: 5px; }
        .hallazgos-table { width: 100%; }
        .hallazgos-table td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
        .hallazgos-table .lbl { font-weight: bold; width: 70%; }
        .hallazgos-table .val { text-align: right; width: 30%; }
        .val-bueno { color: #28a745; font-weight: bold; }
        .val-regular { color: #fd7e14; font-weight: bold; }
        .val-malo { color: #dc3545; font-weight: bold; }
        .equipo-estado-Bueno { background-color: #e8f5e9; }
        .equipo-estado-Regular { background-color: #fff8e1; }
        .equipo-estado-Malo { background-color: #fbe9e7; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
            <td><img src="https://i.imgur.com/Q9bQ23T.png" class="logo-img"></td>
            <td class="empresa-info">
                <span style="font-size: 16px; color: #343a40;">REPORTE DE DIAGNÓSTICO</span><br>
                <strong>REVISIÓN #${datos.header?.id || 'N/A'}</strong><br>
                Fecha: ${formatDate(datos.header?.fecha_revision)}
            </td>
        </tr>
      </table>

      <div class="cliente-box">
        <table width="100%">
            <tr>
                <td width="60%">
                    <div class="cliente-label">Cliente</div>
                    <div class="cliente-dato" style="font-size: 14px; font-weight: bold;">${datos.header?.cliente_nombre || ''}</div>
                    <div class="cliente-dato">${datos.header?.cliente_direccion || ''}</div>
                    <div class="cliente-dato">${datos.header?.cliente_email || ''}</div>
                </td>
                <td width="40%" style="border-left: 1px solid #dee2e6; padding-left: 15px;">
                    <div class="cliente-label">Técnico Asignado</div>
                    <div class="cliente-dato">${datos.header?.tecnico_nombre || 'Técnico LETE'}</div>
                </td>
            </tr>
        </table>
      </div>

      <div class="section-header">Diagnóstico Ejecutivo (Realizado con IA)</div>
      <p style="text-align: justify; padding: 0 5px 15px 5px; font-style: italic; color: #555;">${diagnosticoIA}</p>
      
      <div class="section-header">Hallazgos de Instalación</div>
      <table class="items-table hallazgos-table">
          <tr> <td class="lbl">Tipo de Servicio</td> <td class="val">${datos.mediciones?.tipo_servicio || ''}</td> </tr>
          <tr> <td class="lbl">¿Cuenta con Sello CFE?</td> <td class="val ${selloCfeClass}">${selloCfeText}</td> </tr>
          <tr> <td class="lbl">Tornillos Flojos en C.C.</td> <td class="val ${tornillosClass}">${tornillosText}</td> </tr>
          <tr> <td class="lbl">Capacidad Interruptor vs Calibre</td> <td class="val ${capacidadClass}">${capacidadText}</td> </tr>
          <tr> <td class="lbl">Edad de Instalación</td> <td class="val">${datos.mediciones?.edad_instalacion || ''}</td> </tr>
          <tr> <td class="lbl">Observaciones del C.C.</td> <td class="val">${datos.mediciones?.observaciones_cc || 'N/A'}</td> </tr>
      </table>

      <div class="section-header">Panel de Mediciones</div>
      <table class="items-table hallazgos-table">
          <tr><td colspan="2" style="background: #f8f9fa; font-weight: bold; color: #0056b3;">Mediciones de Carga</td></tr>
          <tr><td class="lbl">Voltaje (Fase-Neutro)</td><td class="val">${formatNum(datos.mediciones?.voltaje_medido)} V</td></tr>
          <tr><td class="lbl">Corriente Red F1</td><td class="val">${formatNum(datos.mediciones?.corriente_red_f1)} A</td></tr>
          ${fasesHtml}
      </table>

      ${solaresHtml}

      <div class="section-header">Análisis de Equipos Registrados</div>
      <table class="items-table">
        <thead> <tr> <th>Equipo</th> <th>Ubicación/Detalle</th> <th>Amperaje</th> <th>Estado</th> </tr> </thead>
        <tbody>
            ${equiposHtml}
        </tbody>
      </table>

      <div class="section-header">Causas de Alto Consumo Detectadas</div>
      <div style="padding: 10px 15px;">
        <ul>${causasHtml}</ul>
      </div>

      <div class="section-header">Recomendaciones Clave del Técnico</div>
      <div style="padding: 10px 15px; text-align: justify; white-space: pre-wrap; background: #fdfdfd;">${datos.recomendaciones_tecnico || 'Ninguna recomendación adicional.'}</div>

      <div class="section-header">Cierre y Firmas</div>
      <div style="text-align: center; margin-top: 20px;">
          <div class="firma-box">
             <div class="firma-label">Firma del Ingeniero</div>
          </div>
          <div class="firma-box">
              ${datos.firma_base64 ? `<img src="${datos.firma_base64}" class="firma-img">` : ''}
              <div class="firma-label">Firma del Cliente</div>
          </div>
      </div>
    </body>
    </html>
  `;
};

export const generarPDF = async (datos) => {
  console.log('Iniciando generación de PDF Profesional (Node.js)...');

  // 1. Obtener Diagnóstico IA
  const diagnosticoIA = await generarDiagnosticoIA(datos);

  // 2. Generar HTML
  const html = getHtmlPlantilla(datos, diagnosticoIA);

  // 3. Generar PDF con Puppeteer
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
  console.log('PDF generado exitosamente.');
  return pdfBuffer;
};
