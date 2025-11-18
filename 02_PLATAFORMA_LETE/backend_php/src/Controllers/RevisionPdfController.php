<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/GeminiService.php';
require_once __DIR__ . '/../Services/ResendService.php';

use Dompdf\Dompdf;
use Dompdf\Options;

class RevisionPdfController {
    private CalculosService $service;
    private GeminiService $gemini;
    private ResendService $resend;
    private string $apiKey;

    public function __construct() {
        require_once __DIR__ . '/../../config/bootstrap.php';
        if (!isset($_ENV['GEMINI_API_KEY'])) {
            throw new \Exception("Error: La variable de entorno GEMINI_API_KEY no está configurada.");
        }
        $this->apiKey = $_ENV['GEMINI_API_KEY'];
        $this->service = new CalculosService();
        $this->gemini = new GeminiService();
        $this->resend = new ResendService();
    }

    public function generarYGuardarPdfRevision(int $revisionId): ?string {
        $datos = $this->service->obtenerRevisionCompletaPorId($revisionId);
        if (!$datos || !$datos['header']) {
            error_log("No se encontraron datos completos para la revisión ID: " . $revisionId);
            return null;
        }

        $dirPdfs = __DIR__ . '/../../public/pdfs/';
        if (!is_dir($dirPdfs)) {
            mkdir($dirPdfs, 0777, true);
        }

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);

        $diagnosticoIA = $this->generarDiagnosticoIA($datos);
        $diagnosticoIAHtml = '<p style="text-align: justify; padding: 0 5px 15px 5px; font-style: italic; color: #555;">' . htmlspecialchars($diagnosticoIA) . '</p>';

        $cssPath = __DIR__ . '/../../public/css/revision-pdf.css';
        $estilosCss = file_get_contents($cssPath);

        $html = '
        <html> <head> <meta charset="UTF-8"> <style>' . $estilosCss . '</style> </head> <body>
        <table class="header-table"> <tr>
            <td><img src="https://i.imgur.com/Q9bQ23T.png" class="logo-img" style="max-width: 150px;"></td>
            <td class="empresa-info">
                <span style="font-size: 16px; color: #343a40;">REPORTE DE DIAGNÓSTICO</span><br>
                <strong>REVISIÓN #' . $datos['header']['id'] . '</strong><br>
                Fecha: ' . date("d/m/Y", strtotime($datos['header']['fecha_revision'])) . '
            </td>
        </tr> </table>
        <div class="cliente-box"> <table width="100%"> <tr>
            <td width="60%">
                <div class="cliente-label">Cliente</div>
                <div class="cliente-dato" style="font-size: 14px; font-weight: bold;">' . htmlspecialchars($datos['header']['cliente_nombre']) . '</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['cliente_direccion']) . '</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['cliente_email']) . '</div>
            </td>
            <td width="40%" style="border-left: 1px solid #dee2e6; padding-left: 15px;">
                <div class="cliente-label">Técnico Asignado</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['tecnico_nombre']) . '</div>
            </td>
        </tr> </table> </div>
        <div class="section-header">Diagnóstico Ejecutivo (Realizado con IA)</div> ' . $diagnosticoIAHtml . '
        <div class="section-header">Hallazgos de Instalación</div>
        <table class="items-table hallazgos-table">
            <tr> <td class="lbl">Tipo de Servicio</td> <td class="val">' . htmlspecialchars($datos['mediciones']['tipo_servicio']) . '</td> </tr>
            <tr> <td class="lbl">¿Cuenta con Sello CFE?</td> <td class="val ' . ($datos['mediciones']['sello_cfe'] ? 'val-bueno' : 'val-malo') . '">' . ($datos['mediciones']['sello_cfe'] ? 'Sí' : 'No') . '</td> </tr>
            <tr> <td class="lbl">Tornillos Flojos en C.C.</td> <td class="val ' . ($datos['mediciones']['tornillos_flojos'] ? 'val-malo' : 'val-bueno') . '">' . ($datos['mediciones']['tornillos_flojos'] ? '¡Sí! (Riesgo Detectado)' : 'No (Correcto)') . '</td> </tr>
            <tr> <td class="lbl">Capacidad Interruptor vs Calibre</td> <td class="val ' . ($datos['mediciones']['capacidad_vs_calibre'] ? 'val-bueno' : 'val-malo') . '">' . ($datos['mediciones']['capacidad_vs_calibre'] ? 'Correcto' : '¡Incorrecto! (Riesgo de Incendio)') . '</td> </tr>
            <tr> <td class="lbl">Edad de Instalación</td> <td class="val">' . htmlspecialchars($datos['mediciones']['edad_instalacion']) . '</td> </tr>
            <tr> <td class="lbl">Observaciones del C.C.</td> <td class="val">' . htmlspecialchars($datos['mediciones']['observaciones_cc'] ?: 'N/A') . '</td> </tr>
        </table>
        <div class="section-header">Panel de Mediciones</div>
        <table class="items-table hallazgos-table">
            <tr><td colspan="2" style="background: #f8f9fa; font-weight: bold; color: #0056b3;">Mediciones de Carga</td></tr>
            <tr><td class="lbl">Voltaje (Fase-Neutro)</td><td class="val">' . number_format($datos['mediciones']['voltaje_medido'], 1) . ' V</td></tr>
            <tr><td class="lbl">Corriente Red F1</td><td class="val">' . number_format($datos['mediciones']['corriente_red_f1'], 1) . ' A</td></tr>';
        if ($datos['mediciones']['tipo_servicio'] !== 'Monofásico') { $html .= '<tr><td class="lbl">Corriente Red F2</td><td class="val">' . number_format($datos['mediciones']['corriente_red_f2'], 1) . ' A</td></tr>'; }
        if (strpos($datos['mediciones']['tipo_servicio'], 'Trifásico') !== false) { $html .= '<tr><td class="lbl">Corriente Red F3</td><td class="val">' . number_format($datos['mediciones']['corriente_red_f3'], 1) . ' A</td></tr>'; }
        $html .= '</table>';

        if (isset($datos['mediciones']['cantidad_paneles']) && $datos['mediciones']['cantidad_paneles'] > 0) {
            $html .= '<div class="section-header">Análisis de Paneles Solares</div>
            <table class="items-table hallazgos-table">
                <tr><td class="lbl">Cantidad de Paneles</td><td class="val">' . $datos['mediciones']['cantidad_paneles'] . '</td></tr>
                <tr><td class="lbl">Watts por Panel</td><td class="val">' . $datos['mediciones']['watts_por_panel'] . ' W</td></tr>
                <tr><td class="lbl">Antigüedad</td><td class="val">' . $datos['mediciones']['paneles_antiguedad_anos'] . ' años</td></tr>
            </table>';
        }

        $html .= '<div class="section-header">Análisis de Equipos Registrados</div>
        <table class="items-table"> <thead> <tr> <th>Equipo</th> <th>Ubicación</th> <th>Amperaje Medido</th> <th>Estado</th> </tr> </thead> <tbody>';
        foreach ($datos['equipos'] as $equipo) {
            $estadoClass = htmlspecialchars($equipo['estado_equipo']);
            $html .= '<tr class="equipo-estado-' . $estadoClass . '">
                        <td>' . htmlspecialchars($equipo['nombre_equipo']) . '</td>
                        <td>' . htmlspecialchars($equipo['ubicacion']) . '</td>
                        <td>' . number_format((float)$equipo['amperaje'], 1) . ' A</td>
                        <td>' . $estadoClass . '</td>
                      </tr>';
        }
        $html .= '</tbody> </table>
        <div class="section-header">Causas de Alto Consumo Detectadas</div> <div style="padding: 10px 15px;"> <ul>';
        foreach ($datos['causas_alto_consumo'] as $causa) { $html .= '<li>' . htmlspecialchars($causa) . '</li>'; }
        $html .= '</ul> </div>
        <div class="section-header">Recomendaciones Clave del Técnico</div>
        <div style="padding: 10px 15px; text-align: justify; white-space: pre-wrap; background: #fdfdfd;">' . htmlspecialchars($datos['recomendaciones_tecnico'] ?: 'N/A') . '</div>
        <div class="section-header">Cierre y Firmas</div>
        <div style="text-align: center; margin-top: 20px;">
            <div class="firma-box"> <div class="firma-label">Firma del Ingeniero</div> </div>
            <div class="firma-box">
                <img src="' . $datos['firma_base64'] . '" class="firma-img">
                <div class="firma-label">Firma del Cliente</div>
            </div>
        </div>
        </body> </html>';

        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $nombreFinal = "Reporte_Revision_{$revisionId}.pdf";
        $rutaGuardado = $dirPdfs . $nombreFinal;
        $output = $dompdf->output();

        if (file_put_contents($rutaGuardado, $output) === false) {
            error_log("Error al guardar el PDF en: " . $rutaGuardado);
            return null;
        }

        return 'pdfs/' . $nombreFinal;
    }

    /**
     * Método de entrada para la ruta. Maneja request POST (JSON) y GET (Query Param).
     */
    public function generarPdfFinalDesdeRevision(): void {
        // Intentar leer JSON Body (POST)
        $data = json_decode(file_get_contents('php://input'), true);
        $revisionId = $data['revision_id'] ?? null;
        $isGetRequest = $_SERVER['REQUEST_METHOD'] === 'GET';
        $sendEmail = filter_var($data['send_email'] ?? $_GET['send_email'] ?? 'false', FILTER_VALIDATE_BOOLEAN);

        // Si no hay JSON y es GET, intentar leer Query Param
        if (!$revisionId && $isGetRequest && isset($_GET['revision_id'])) {
            $revisionId = $_GET['revision_id'];
        }

        if (!$revisionId) {
            http_response_code(400);
            if (!$isGetRequest) {
                echo json_encode(['error' => 'Falta el revision_id.']);
            } else {
                echo 'Error: Falta el ID de la revisión.';
            }
            return;
        }

        try {
            $relativeUrl = $this->generarYGuardarPdfRevision((int)$revisionId);

            if ($relativeUrl) {
                $fullPath = __DIR__ . '/../../public/' . $relativeUrl;

                if ($sendEmail && !$isGetRequest) {
                    $datosRevision = $this->service->obtenerRevisionCompletaPorId((int)$revisionId);
                    if ($datosRevision && isset($datosRevision['header']['cliente_email'])) {
                        $this->resend->enviarRevision(
                            $datosRevision['header']['cliente_email'],
                            $datosRevision['header']['cliente_nombre'],
                            (int)$revisionId,
                            $fullPath
                        );
                    }
                }

                if ($isGetRequest) {
                    if (file_exists($fullPath)) {
                        header('Content-Type: application/pdf');
                        header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');
                        header('Content-Length: ' . filesize($fullPath));
                        readfile($fullPath);
                        exit;
                    } else {
                        http_response_code(404);
                        echo 'Error: El archivo PDF generado no fue encontrado.';
                        return;
                    }
                } else {
                    echo json_encode(['pdf_url' => $relativeUrl]);
                }
            } else {
                http_response_code(500);
                $errorMessage = 'No se pudo generar el PDF de la revisión.';
                if (!$isGetRequest) {
                    echo json_encode(['error' => $errorMessage]);
                } else {
                    echo 'Error: ' . $errorMessage;
                }
            }
        } catch (Exception $e) {
            http_response_code(500);
            error_log("Error en generarPdfFinalDesdeRevision: " . $e->getMessage());
            if (!$isGetRequest) {
                echo json_encode(['error' => 'Error interno del servidor al generar el PDF.']);
            } else {
                echo 'Error interno del servidor al generar el PDF.';
            }
        }
    }

    private function generarDiagnosticoIA(array $datosRevision): string {
        $apiKey = $this->apiKey;
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey;

        $datosParaIA = [
            'servicio' => $datosRevision['mediciones']['tipo_servicio'],
            'hallazgos_clave' => [
                'sello_cfe' => $datosRevision['mediciones']['sello_cfe'],
                'tornillos_flojos' => $datosRevision['mediciones']['tornillos_flojos'],
                'capacidad_vs_calibre' => $datosRevision['mediciones']['capacidad_vs_calibre'],
            ],
            'mediciones_fuga' => [
                'fuga_f1' => $datosRevision['mediciones']['corriente_fuga_f1'],
            ],
            'equipos_mal_estado' => count(array_filter($datosRevision['equipos'], fn($eq) => $eq['estado_equipo'] === 'Malo')),
            'causas_detectadas' => $datosRevision['causas_alto_consumo'],
            'recomendaciones_tecnico' => $datosRevision['recomendaciones_tecnico']
        ];
        $datosJson = json_encode($datosParaIA);
        $prompt = "Eres un ingeniero eléctrico experto de 'Luz en tu Espacio'. Analiza los siguientes datos JSON de una revisión: $datosJson. Tu tarea es redactar un párrafo de 'Diagnóstico Ejecutivo' para el cliente final. Debe ser profesional, tranquilizador pero honesto. Basándote en los datos: 1. Menciona el hallazgo más crítico (ej. 'tornillos flojos', 'fuga alta', o 'equipos en mal estado'). 2. Explica brevemente qué significa (ej. 'lo cual representaba un riesgo de seguridad'). 3. Menciona las recomendaciones clave del técnico si las hay. 4. Concluye positivamente. Responde SÓLO con el párrafo de diagnóstico. No uses markdown.";
        $data = ['contents' => [['parts' => [['text' => $prompt]]]], 'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 8000]];

        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            if ($response === false) {
                error_log("cURL Error: " . curl_error($ch));
                curl_close($ch);
                return 'Se realizó una inspección detallada de sus instalaciones para verificar el correcto funcionamiento y seguridad.';
            }
            curl_close($ch);
            $json = json_decode($response, true);
            return trim($json['candidates'][0]['content']['parts'][0]['text'] ?? 'No se pudo generar el diagnóstico.');
        } catch (Exception $e) {
            error_log("Exception in IA call: " . $e->getMessage());
            return 'Se realizó una inspección detallada de sus instalaciones para verificar el correcto funcionamiento y seguridad de sus conexiones.';
        }
    }
}
?>