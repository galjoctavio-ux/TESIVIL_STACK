<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/ResendService.php';

use Dompdf\Dompdf;
use Dompdf\Options;

class RevisionPdfController {
    private CalculosService $service;
    private ResendService $resend;
    private string $apiKey;

    public function __construct() {
        require_once __DIR__ . '/../../config/bootstrap.php';
        if (!isset($_ENV['GEMINI_API_KEY'])) {
            // Advertencia silenciosa o manejo de error suave si no es crítica
            $this->apiKey = $_ENV['GEMINI_API_KEY'] ?? '';
        } else {
            $this->apiKey = $_ENV['GEMINI_API_KEY'];
        }
        $this->service = new CalculosService();
        $this->resend = new ResendService();
    }

    /**
     * Genera el PDF. Si recibe $datosExternos, usa esos. Si no, intenta buscarlos en DB local.
     */
    public function generarYGuardarPdfRevision(int $revisionId, ?array $datosExternos = null): ?string {
        
        // 1. Decidir origen de datos
        if ($datosExternos) {
            $datos = $datosExternos;
        } else {
            // Fallback legacy: Buscar en MySQL local
            $datos = $this->service->obtenerRevisionCompletaPorId($revisionId);
        }

        if (!$datos || !isset($datos['header'])) {
            error_log("No se encontraron datos para la revisión ID: " . $revisionId);
            return null;
        }

        // 2. Preparar directorio
        $dirPdfs = __DIR__ . '/../../public/pdfs/';
        if (!is_dir($dirPdfs)) {
            mkdir($dirPdfs, 0777, true);
        }

        // 3. Configurar Dompdf
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true); // Vital para imágenes de Supabase
        $dompdf = new Dompdf($options);

        // 4. Generar Diagnóstico IA (Omitir si no hay API Key)
        $diagnosticoIA = "Diagnóstico no disponible (IA Key no configurada).";
        if (!empty($this->apiKey)) {
            $diagnosticoIA = $this->generarDiagnosticoIA($datos);
        }
        
        $diagnosticoIAHtml = '<p style="text-align: justify; padding: 0 5px 15px 5px; font-style: italic; color: #555;">' . htmlspecialchars($diagnosticoIA) . '</p>';

        // 5. Cargar CSS
        $cssPath = __DIR__ . '/../../public/css/revision-pdf.css';
        $estilosCss = file_exists($cssPath) ? file_get_contents($cssPath) : '';

        // 6. Construir HTML
        // Nota: Usamos @ para suprimir warnings si alguna clave opcional falta en el JSON manual
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
                <div class="cliente-dato" style="font-size: 14px; font-weight: bold;">' . htmlspecialchars($datos['header']['cliente_nombre'] ?? '') . '</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['cliente_direccion'] ?? '') . '</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['cliente_email'] ?? '') . '</div>
            </td>
            <td width="40%" style="border-left: 1px solid #dee2e6; padding-left: 15px;">
                <div class="cliente-label">Técnico Asignado</div>
                <div class="cliente-dato">' . htmlspecialchars($datos['header']['tecnico_nombre'] ?? 'Técnico LETE') . '</div>
            </td>
        </tr> </table> </div>
        <div class="section-header">Diagnóstico Ejecutivo (Realizado con IA)</div> ' . $diagnosticoIAHtml . '
        
        <div class="section-header">Hallazgos de Instalación</div>
        <table class="items-table hallazgos-table">
            <tr> <td class="lbl">Tipo de Servicio</td> <td class="val">' . htmlspecialchars($datos['mediciones']['tipo_servicio'] ?? '') . '</td> </tr>
            <tr> <td class="lbl">¿Cuenta con Sello CFE?</td> <td class="val ' . (($datos['mediciones']['sello_cfe'] ?? false) ? 'val-bueno' : 'val-malo') . '">' . (($datos['mediciones']['sello_cfe'] ?? false) ? 'Sí' : 'No') . '</td> </tr>
            <tr> <td class="lbl">Tornillos Flojos en C.C.</td> <td class="val ' . (($datos['mediciones']['tornillos_flojos'] ?? false) ? 'val-malo' : 'val-bueno') . '">' . (($datos['mediciones']['tornillos_flojos'] ?? false) ? '¡Sí! (Riesgo Detectado)' : 'No (Correcto)') . '</td> </tr>
            <tr> <td class="lbl">Capacidad Interruptor vs Calibre</td> <td class="val ' . (($datos['mediciones']['capacidad_vs_calibre'] ?? false) ? 'val-bueno' : 'val-malo') . '">' . (($datos['mediciones']['capacidad_vs_calibre'] ?? false) ? 'Correcto' : '¡Incorrecto! (Riesgo de Incendio)') . '</td> </tr>
            <tr> <td class="lbl">Edad de Instalación</td> <td class="val">' . htmlspecialchars($datos['mediciones']['edad_instalacion'] ?? '') . '</td> </tr>
            <tr> <td class="lbl">Observaciones del C.C.</td> <td class="val">' . htmlspecialchars($datos['mediciones']['observaciones_cc'] ?: 'N/A') . '</td> </tr>
        </table>

        <div class="section-header">Panel de Mediciones</div>
        <table class="items-table hallazgos-table">
            <tr><td colspan="2" style="background: #f8f9fa; font-weight: bold; color: #0056b3;">Mediciones de Carga</td></tr>
            <tr><td class="lbl">Voltaje (Fase-Neutro)</td><td class="val">' . number_format((float)($datos['mediciones']['voltaje_medido'] ?? 0), 1) . ' V</td></tr>
            <tr><td class="lbl">Corriente Red F1</td><td class="val">' . number_format((float)($datos['mediciones']['corriente_red_f1'] ?? 0), 1) . ' A</td></tr>';
        
        if (($datos['mediciones']['tipo_servicio'] ?? '') !== 'Monofásico') { 
            $html .= '<tr><td class="lbl">Corriente Red F2</td><td class="val">' . number_format((float)($datos['mediciones']['corriente_red_f2'] ?? 0), 1) . ' A</td></tr>'; 
        }
        if (strpos(($datos['mediciones']['tipo_servicio'] ?? ''), 'Trifásico') !== false) { 
            $html .= '<tr><td class="lbl">Corriente Red F3</td><td class="val">' . number_format((float)($datos['mediciones']['corriente_red_f3'] ?? 0), 1) . ' A</td></tr>'; 
        }
        $html .= '</table>';

        // Paneles Solares
        if (isset($datos['mediciones']['cantidad_paneles']) && $datos['mediciones']['cantidad_paneles'] > 0) {
            $html .= '<div class="section-header">Análisis de Paneles Solares</div>
            <table class="items-table hallazgos-table">
                <tr><td class="lbl">Cantidad de Paneles</td><td class="val">' . $datos['mediciones']['cantidad_paneles'] . '</td></tr>
                <tr><td class="lbl">Watts por Panel</td><td class="val">' . $datos['mediciones']['watts_por_panel'] . ' W</td></tr>
                <tr><td class="lbl">Antigüedad</td><td class="val">' . $datos['mediciones']['paneles_antiguedad_anos'] . ' años</td></tr>
            </table>';
        }

        // Equipos
        $html .= '<div class="section-header">Análisis de Equipos Registrados</div>
        <table class="items-table"> <thead> <tr> <th>Equipo</th> <th>Ubicación/Detalle</th> <th>Amperaje</th> <th>Estado</th> </tr> </thead> <tbody>';
        
        if (!empty($datos['equipos'])) {
            foreach ($datos['equipos'] as $equipo) {
                $estadoClass = htmlspecialchars($equipo['estado_equipo'] ?? '');
                $html .= '<tr class="equipo-estado-' . $estadoClass . '">
                            <td>' . htmlspecialchars($equipo['nombre_equipo'] ?? '') . '</td>
                            <td>' . htmlspecialchars($equipo['ubicacion'] ?? '') . '</td>
                            <td>' . number_format((float)($equipo['amperaje'] ?? 0), 1) . ' A</td>
                            <td>' . $estadoClass . '</td>
                          </tr>';
            }
        }
        $html .= '</tbody> </table>

        <div class="section-header">Causas de Alto Consumo Detectadas</div> <div style="padding: 10px 15px;"> <ul>';
        if (!empty($datos['causas_alto_consumo'])) {
            foreach ($datos['causas_alto_consumo'] as $causa) { $html .= '<li>' . htmlspecialchars($causa) . '</li>'; }
        } else {
            $html .= '<li>No se detectaron causas críticas específicas.</li>';
        }
        $html .= '</ul> </div>

        <div class="section-header">Recomendaciones Clave del Técnico</div>
        <div style="padding: 10px 15px; text-align: justify; white-space: pre-wrap; background: #fdfdfd;">' . htmlspecialchars($datos['recomendaciones_tecnico'] ?: 'Ninguna recomendación adicional.') . '</div>

        <div class="section-header">Cierre y Firmas</div>
        <div style="text-align: center; margin-top: 20px;">
            <div class="firma-box"> <div class="firma-label">Firma del Ingeniero</div> </div>
            <div class="firma-box">
                <img src="' . ($datos['firma_base64'] ?? '') . '" class="firma-img">
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

    public function generarPdfFinalDesdeRevision(): void {
        // Leer JSON Body (Node.js envía esto)
        $data = json_decode(file_get_contents('php://input'), true);
        
        $revisionId = $data['revision_id'] ?? null;
        $fullData   = $data['full_data'] ?? null; // NUEVO: Recibir datos completos

        if (!$revisionId) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta el revision_id.']);
            return;
        }

        try {
            // Pasamos $fullData si existe
            $relativeUrl = $this->generarYGuardarPdfRevision((int)$revisionId, $fullData);

            if ($relativeUrl) {
                echo json_encode(['pdf_url' => $relativeUrl]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'No se pudo generar el PDF.']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            error_log("Error PDF Controller: " . $e->getMessage());
            echo json_encode(['error' => 'Error interno: ' . $e->getMessage()]);
        }
    }

    private function generarDiagnosticoIA(array $datosRevision): string {
        if (empty($this->apiKey)) return "IA no configurada.";

        $model = 'gemini-2.5-flash';
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . $this->apiKey;

        // Manejo seguro de claves con ?? para evitar undefined index
        $datosParaIA = [
            'servicio' => $datosRevision['mediciones']['tipo_servicio'] ?? 'Desconocido',
            'hallazgos_clave' => [
                'sello_cfe' => $datosRevision['mediciones']['sello_cfe'] ?? false,
                'tornillos_flojos' => $datosRevision['mediciones']['tornillos_flojos'] ?? false,
                'capacidad_vs_calibre' => $datosRevision['mediciones']['capacidad_vs_calibre'] ?? true,
            ],
            'mediciones_fuga' => [
                'fuga_f1' => $datosRevision['mediciones']['corriente_fuga_f1'] ?? 0,
            ],
            'equipos_mal_estado' => isset($datosRevision['equipos']) ? count(array_filter($datosRevision['equipos'], fn($eq) => ($eq['estado_equipo'] ?? '') === 'Malo')) : 0,
            'causas_detectadas' => $datosRevision['causas_alto_consumo'] ?? [],
            'recomendaciones_tecnico' => $datosRevision['recomendaciones_tecnico'] ?? ''
        ];
        $datosJson = json_encode($datosParaIA);

        $prompt = "Analiza los siguientes datos JSON de una revisión eléctrica: {$datosJson}. Redacta un párrafo de 'Diagnóstico Ejecutivo' profesional, breve (max 60 palabras) y tranquilizador para el cliente. Concluye positivamente. Texto plano.";

        $data = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 500]
        ];

        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);

            if ($response === false) { return 'Revisión técnica realizada correctamente.'; }
            curl_close($ch);

            $json = json_decode($response, true);
            return trim($json['candidates'][0]['content']['parts'][0]['text'] ?? 'Revisión técnica completa.');
        } catch (Exception $e) {
            return 'Revisión técnica realizada correctamente.';
        }
    }
}
?>