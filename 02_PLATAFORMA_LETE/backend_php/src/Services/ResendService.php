<?php
declare(strict_types=1);

class ResendService {
    private string $apiKey;
    private string $emailFrom;
    private string $apiUrl = 'https://api.resend.com/emails';

    public function __construct() {
        $this->apiKey = 're_Ytu81GJn_JFdEAage8LCDTKJEEXR5oeec'; 
        $this->emailFrom = 'Luz en tu Espacio <cotizaciones@tesivil.com>';
    }

    public function enviarCotizacion(string $uuid, string $emailCliente, string $nombreCliente, ?int $cotizacionId = null): void {
        try {
            $identificador = $cotizacionId ?? $uuid;
            $pdfUrl = "https://www.tesivil.com/api/cotizar/pdf?uuid=" . $uuid;
            $whatsappNumber = "5213326395038"; // Tu número formato internacional
            $mensajeWsp = "Hola, recibí la cotización $identificador y quiero autorizarla. ¿Cuáles son los pasos para el anticipo?";
            $linkWsp = "https://wa.me/$whatsappNumber?text=" . urlencode($mensajeWsp);

            $subject = "Propuesta Comercial: Luz en tu Espacio (Folio #$identificador)";
            
            // DISEÑO DEL CORREO: Limpio, Profesional y Enfocado a la Acción
            $htmlBody = '
            <html>
            <body style="font-family: Helvetica, Arial, sans-serif; line-height: 1.6; background-color: #f4f4f4; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://www.tesivil.com/logo_LETE.png" alt="Luz en tu Espacio" style="max-width: 180px;">
                    </div>

                    <h2 style="color: #333; margin-top: 0;">Hola, '. htmlspecialchars($nombreCliente) .'.</h2>
                    <p style="color: #555; font-size: 16px;">
                        Gracias por permitirnos evaluar tu proyecto. Adjunto encontrarás la propuesta detallada con la solución técnica recomendada.
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="'. $pdfUrl .'" style="background-color: #0056b3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                            📄 Ver Propuesta PDF
                        </a>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">

                    <div style="background-color: #e9f7ef; padding: 20px; border-radius: 5px; border-left: 5px solid #25D366;">
                        <h3 style="margin-top: 0; color: #1E4620;">¿Listo para iniciar?</h3>
                        <p style="margin-bottom: 15px; color: #333;">Autoriza tu proyecto directamente por WhatsApp para agendar tu fecha de inicio.</p>
                        <a href="'. $linkWsp .'" style="color: #25D366; text-decoration: none; font-weight: bold; font-size: 15px;">
                            👉 Clic aquí para Autorizar por WhatsApp
                        </a>
                    </div>

                    <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                        Si tienes dudas técnicas, responde a este correo o escríbenos al WhatsApp.<br>
                        Atentamente, <strong>El Equipo de Luz en tu Espacio</strong>
                    </p>
                </div>
            </body>
            </html>';
            
            $data = [
                'from' => $this->emailFrom,
                'to' => [$emailCliente],
                'subject' => $subject,
                'html' => $htmlBody,
            ];
            
            $ch = curl_init($this->apiUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($httpCode !== 200) {
                throw new \Exception("Error Resend API: $response");
            }
            
        } catch (\Exception $e) {
            error_log("Error enviando email: " . $e->getMessage());
        }
    }
}
?>