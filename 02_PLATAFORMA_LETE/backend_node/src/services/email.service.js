import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Asumimos que tu dominio verificado en Resend es tesivil.com
const fromEmail = 'reportes@tesivil.com';

/**
 * Envía el email con el reporte al cliente
 * @param {string} clienteEmail - El email del cliente
 * @param {string} clienteNombre - El nombre del cliente
 * @param {string} pdfUrl - La URL pública del PDF
 */
export const enviarReportePorEmail = async (clienteEmail, clienteNombre, pdfUrl, causasAltoConsumo) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no está configurada. Saltando envío de email.');
    return;
  }

  if (!pdfUrl) {
    console.warn('No hay pdfUrl. Saltando envío de email.');
    return;
  }

  const hallazgosSeguros = Array.isArray(causasAltoConsumo) ? causasAltoConsumo : [];

  // Generar la lista de causas de alto consumo
  const causasHtml = hallazgosSeguros.length > 0
    ? `
        <div style="background-color: #f0f5ff; padding: 20px; border-radius: 6px; margin: 25px 0;">
          <h2 style="color: #10213f; font-size: 18px; margin-bottom: 15px;">Resultados de la Revisión:</h2>
          <ul style="list-style-type: none; padding-left: 0; font-size: 16px;">
            ${hallazgosSeguros.map(item => `
              <li style="margin-bottom: 10px; display: flex; align-items: start;">
                <span style="color: #2563eb; margin-right: 10px; font-weight: bold;">✔</span>
                <span>${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `
    : '';

  console.log(`Enviando reporte a ${clienteEmail}...`);

  try {
    const { data, error } = await resend.emails.send({
      from: `Reportes Tesivil <${fromEmail}>`,
      to: [clienteEmail],
      subject: 'Reporte de Diagnóstico Eléctrico de LETE listo',
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #10213f; padding: 20px 30px; text-align: center;">
            <img src="https://www.tesivil.com/logo_LETE.png" alt="LETE Logo" style="max-width: 150px;">
          </div>
          <div style="padding: 30px; color: #333333; line-height: 1.6;">
            <h1 style="color: #10213f; font-size: 24px; margin-bottom: 20px;">Hola, ${clienteNombre},</h1>
            <p style="font-size: 16px;">Gracias por confiar en <strong>Luz en tu Espacio (LETE)</strong> para realizar el diagnóstico de tu instalación eléctrica.</p>
            <p style="font-size: 16px;">Hemos concluido la revisión y tu reporte detallado ya está disponible. En él encontrarás nuestras observaciones, mediciones clave y recomendaciones para optimizar tu consumo y seguridad.</p>

            ${causasHtml}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${pdfUrl}" style="background-color: #10213f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Ver mi Reporte PDF
              </a>
            </div>
            <p style="font-size: 16px;">Si tienes alguna pregunta sobre los resultados, no dudes en contactarnos.</p>
            <p style="font-size: 16px; margin-top: 25px;">Atentamente,<br>El equipo de <strong>LETE</strong></p>
          </div>
          <div style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; color: #888888; font-size: 12px;">
            <p>Este es un correo electrónico automatizado. Por favor, no respondas directamente a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} LETE | Todos los derechos reservados.</p>
          </div>
        </div>
      `,
      // Nota: Resend no adjunta la URL directamente,
      // la ponemos como un enlace en el HTML.
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Email enviado exitosamente. ID:', data.id);
    return data.id;

  } catch (error) {
    console.error('Error al enviar email con Resend:', error.message);
    // No relanzamos el error para no fallar toda la revisión
  }
};
