<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/GeminiService.php';

use Dompdf\Dompdf;
use Dompdf\Options;

class PdfController {
    private CalculosService $service;
    private GeminiService $gemini;
    private string $apiKey;

    public function __construct() {
        require_once __DIR__ . '/../../config/bootstrap.php';
        if (!isset($_ENV['GEMINI_API_KEY'])) {
            throw new \Exception("Error: La variable de entorno GEMINI_API_KEY no está configurada.");
        }
        $this->apiKey = $_ENV['GEMINI_API_KEY'];
        $this->service = new CalculosService();
        $this->gemini = new GeminiService();
    }

    // --- NUEVO MÉTODO PÚBLICO PARA GENERACIÓN "ON-WRITE" ---
    /**
     * Genera un PDF, lo guarda físicamente y devuelve la URL pública.
     * @param string $uuid El UUID de la cotización.
     * @return string|null La URL pública del PDF o null si falla.
     */
    public function generarYGuardarPdf(string $uuid): ?string {
        $datos = $this->service->obtenerCotizacionPorUuid($uuid);
        if (!$datos) {
            error_log("No se encontraron datos para la cotización UUID: " . $uuid);
            return null;
        }

        $h = $datos['header'];
        $idCotizacion = (int)$h['id'];

        $dirPdfs = __DIR__ . '/../../public/pdfs/';
        if (!is_dir($dirPdfs)) {
            mkdir($dirPdfs, 0777, true);
        }

        // Limpia archivos antiguos para esta cotización para evitar duplicados
        $archivosViejos = glob($dirPdfs . "C{$idCotizacion}_*.pdf");
        foreach ($archivosViejos as $archivo) {
            unlink($archivo);
        }

        $itemsMateriales = $datos['items_materiales']; 
        $itemsMO = $datos['items_mo'];             
        $config = $datos['global_config'];

        $empresaDir = "Av. Sebastian Bach 4978, Prados Guadalupe, Zapopan, Jal.";
        $empresaTel = "33 2639 5038";
        $empresaEmail = "contacto-lete@tesivil.com";
        $empresaWeb = "www.tesivil.com/lete";
        $nombreAsesor = $h['tecnico_nombre']; // Asignación directa. La lógica de fallback ya está en CotizacionController.
        $fecha = date("d/m/Y", strtotime($h['fecha_creacion']));
        $datosBancariosHtml = nl2br($config['datos_bancarios'] ?? 'Solicitar datos bancarios.');

        $matCD = floatval($h['total_materiales_cd']);
        $moCD = floatval($h['total_mano_obra_cd']);
        $subtotalReal = floatval($h['subtotal_venta']);
        $sumaCD = $matCD + $moCD;
        
        $factor = ($sumaCD > 0) ? ($subtotalReal / $sumaCD) : 1;
        $matCliente = $matCD * $factor;
        $moCliente = $subtotalReal - $matCliente; 

        $iva = floatval($h['monto_iva']);
        $total = floatval($h['precio_venta_final']);
        $anticipo = floatval($h['monto_anticipo']);

        $tieneDescuento = isset($h['descuento_pct']) && floatval($h['descuento_pct']) > 0;
        $descuentoMonto = 0;
        $subtotalSinDescuento = $subtotalReal;
        
        if ($tieneDescuento) {
            $subtotalOriginal = $subtotalReal / (1 - (floatval($h['descuento_pct'])/100));
            $descuentoMonto = $subtotalOriginal - $subtotalReal;
            $subtotalSinDescuento = $subtotalOriginal;
        }

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true); 
        $dompdf = new Dompdf($options);

        // --- Nivel 2: Generar Resumen con IA ---
        $resumenIA = '';
        try {
            $resumenIA = $this->gemini->generarResumenObjetivo($datos);
        } catch (Exception $e) {
            error_log("Fallo en la llamada a GeminiService para resumen: " . $e->getMessage());
            // El PDF se generará sin el resumen, no es crítico.
        }
        $resumenIAHtml = !empty($resumenIA) ? '<p style="text-align: justify; padding: 0 5px 15px 5px; font-style: italic; color: #555;">' . htmlspecialchars($resumenIA) . '</p>' : '';


        // --- INICIO DE LA PLANTILLA HTML REDISEÑADA ---
        $html = '
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                /* Importar fuente moderna */
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');

                @page { margin: 25px; }
                body {
                    font-family: 'Roboto', sans-serif;
                    color: #444;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .header-table { width: 100%; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 25px; }
                .logo-img { max-width: 180px; max-height: 60px; }
                .empresa-info { text-align: right; font-size: 10px; color: #6c757d; }
                .empresa-info strong { font-size: 12px; color: #0056b3; }
                
                .cliente-box { border: 1px solid #dee2e6; border-left: 5px solid #0056b3; padding: 15px; margin-bottom: 25px; border-radius: 4px; background-color: #f8f9fa; }
                .cliente-label { font-weight: bold; color: #0056b3; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
                .cliente-dato { font-size: 12px; margin-bottom: 5px; }

                .section-header { background-color: #0056b3; color: white; padding: 8px 12px; font-weight: bold; font-size: 12px; margin-top: 20px; border-radius: 4px 4px 0 0; }
                
                /* Tablas con espaciado profesional */
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    margin-bottom: 20px;
                }

                .items-table td {
                    padding: 12px 15px; /* Más espacio vertical y horizontal */
                    border-bottom: 1px solid #f0f0f0; /* Borde muy sutil */
                    vertical-align: top;
                }

                /* Encabezados de tabla limpios y corporativos */
                .items-table th {
                    background-color: #f8f9fa; /* Gris muy claro */
                    color: #0056b3; /* Azul corporativo */
                    text-transform: uppercase;
                    font-size: 9px;
                    letter-spacing: 1px;
                    padding: 10px 15px;
                    text-align: left;
                }

                /* Efecto cebra para facilitar lectura */
                .items-table tr:nth-child(even) {
                    background-color: #fbfbfb;
                }
                .items-table tr:last-child td { border-bottom: none; }


                .col-cant { width: 12%; text-align: center; }
                .col-desc { width: 88%; }
                
                .footer-grid { width: 100%; margin-top: 30px; }
                .footer-left { width: 58%; vertical-align: top; padding-right: 20px; }
                .footer-right { width: 42%; vertical-align: top; }
                
                .bancos-card { border: 1px solid #e9ecef; padding: 15px; border-radius: 4px; font-size: 10px; background: #f8f9fa; }
                .totales-table { width: 100%; }
                .totales-table td { padding: 6px 0; text-align: right; }
                .lbl { color: #495057; }
                .num { font-weight: bold; color: #212529; }
                .total-row td { font-size: 16px; font-weight: bold; color: #0056b3; border-top: 2px solid #0056b3; padding-top: 10px !important; }
                .anticipo-badge { background-color: #0056b3; color: white; padding: 6px 12px; border-radius: 15px; font-weight: bold; font-size: 11px; display: inline-block; }
                
                .legal-footer { position: fixed; bottom: -20px; left: 0; right: 0; text-align: center; font-size: 9px; color: #adb5bd; border-top: 1px solid #e9ecef; padding: 8px 0; background: white; }

                /* Pie de página para términos */
                .terms-footer {
                    margin-top: 30px;
                    font-size: 8px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <table class="header-table">
                <tr>
                    <td><img src="'. $config['logo_url'] .'" class="logo-img"></td>
                    <td class="empresa-info">
                        <strong>LUZ EN TU ESPACIO</strong><br>
                        '. $empresaDir .'<br>
                        Tel: '. $empresaTel .' | '. $empresaEmail .' | '. $empresaWeb .'<br><br>
                        <span style="font-size: 14px; color: #343a40;">COTIZACIÓN <strong>#'. $h['id'] .'</strong></span> | Fecha: '. $fecha .'
                    </td>
                </tr>
            </table>

            <div class="cliente-box">
                <table width="100%">
                    <tr>
                        <td width="60%">
                            <div class="cliente-label">Cliente</div>
                            <div class="cliente-dato" style="font-size: 14px; font-weight: bold;">'. htmlspecialchars($h['cliente_nombre']) .'</div>
                            <div class="cliente-dato">'. htmlspecialchars($h['direccion_obra']) .'</div>
                        </td>
                        <td width="40%" style="border-left: 1px solid #dee2e6; padding-left: 15px;">
                            <div class="cliente-label">Asesor Asignado</div>
                            <div class="cliente-dato">'. htmlspecialchars($nombreAsesor) .'</div>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="section-header">Resumen del Proyecto</div>
            '. $resumenIAHtml .'

            <div class="section-header">Conceptos del Proyecto</div>
            <table class="items-table">
                 <thead>
                    <tr>
                        <th class="col-cant">CANT.</th>
                        <th class="col-desc">DESCRIPCIÓN</th>
                    </tr>
                </thead>
                <tbody>';
        
        if (!empty($itemsMateriales)) {
             $html .= '<tr><td colspan="2" style="padding: 5px 10px; background: #e9ecef; font-weight:bold; color:#0056b3; font-size:10px;">MATERIALES</td></tr>';
            foreach ($itemsMateriales as $item) {
                $html .= '
                    <tr>
                        <td class="col-cant">'. floatval($item['cantidad']) .' '. htmlspecialchars($item['unidad']) .'</td>
                        <td class="col-desc">'. htmlspecialchars($item['nombre']) .'</td>
                    </tr>';
            }
        }

        if (!empty($itemsMO)) {
            $html .= '<tr><td colspan="2" style="padding: 5px 10px; background: #e9ecef; font-weight:bold; color:#0056b3; font-size:10px;">MANO DE OBRA</td></tr>';
            foreach ($itemsMO as $tarea) {
                $descMejorada = $this->mejorarTextoConIA($tarea['descripcion']);
                $html .= '
                        <tr>
                            <td class="col-cant">'. floatval($tarea['horas']) .' hrs</td>
                            <td class="col-desc">'. htmlspecialchars($descMejorada) .'</td>
                        </tr>';
            }
        }
        $html .= '</tbody></table>

            <table class="footer-grid">
                <tr>
                    <td class="footer-left">
                        <div class="bancos-card">
                            <strong style="color:#0056b3;">INFORMACIÓN BANCARIA</strong><br>
                            '. $datosBancariosHtml .'
                            <br><br>
                            <em>* Una vez realizado el pago, favor de enviar comprobante.</em>
                        </div>
                    </td>
                    <td class="footer-right">
                        <table class="totales-table">
                            <tr><td class="lbl">Costo de Materiales:</td><td class="num">$'. number_format($matCliente, 2) .'</td></tr>
                            <tr><td class="lbl">Costo de Mano de Obra:</td><td class="num">$'. number_format($moCliente, 2) .'</td></tr>
                            <tr><td class="lbl">Subtotal:</td><td class="num">$'. number_format($subtotalReal, 2) .'</td></tr>
                            <tr><td class="lbl">IVA (16%):</td><td class="num">$'. number_format($iva, 2) .'</td></tr>
                            <tr class="total-row"><td class="lbl">TOTAL:</td><td class="num">$'. number_format($total, 2) .'</td></tr>
                        </table>

                        <div style="text-align: right; margin-top: 15px;">
                            <div class="anticipo-badge">ANTICIPO REQUERIDO: $'. number_format($anticipo, 2) .'</div>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="terms-footer">
                <strong>Condiciones Comerciales:</strong><br>
                1. La vigencia de esta cotización es de 15 días naturales.<br>
                2. Los tiempos de entrega comenzarán a correr a partir de la recepción del anticipo.<br>
                3. Cualquier trabajo extra no especificado en este documento se cotizará por separado.<br>
                4. En caso de cancelaciones, solo se regresará una parte por gastos administrativos.<br>
                5. Garantía de mano de obra: 90 días sobre vicios ocultos.
            </div>
        </body>
        </html>';
        // --- FIN DE LA PLANTILLA ---

        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        
        $nombreParteIA = $this->generarNombreArchivoIA($itemsMateriales, $h['cliente_nombre']);
        $nombreFinal = "C{$idCotizacion}_{$nombreParteIA}.pdf";
        
        $rutaGuardado = $dirPdfs . $nombreFinal;
        $output = $dompdf->output();

        if (file_put_contents($rutaGuardado, $output) === false) {
            error_log("Error al guardar el PDF en: " . $rutaGuardado);
            return null;
        }

        // Devolver la URL pública relativa
        return 'pdfs/' . $nombreFinal;
    }


    // --- MÉTODO LEGACY: SIRVE EL PDF (AHORA DESDE CACHÉ O LO GENERA) ---
    public function generarPdf(string $uuid): void {
        $datos = $this->service->obtenerCotizacionPorUuid($uuid);
        if (!$datos) {
            http_response_code(404); echo "Cotización no encontrada"; return;
        }

        $idCotizacion = (int)$datos['header']['id'];
        $dirPdfs = __DIR__ . '/../../public/pdfs/';

        $archivosExistentes = glob($dirPdfs . "C{$idCotizacion}_*.pdf");

        if (!empty($archivosExistentes)) {
            $rutaArchivo = $archivosExistentes[0];
        } else {
            // Si no existe, lo genera y guarda
            $urlRelativa = $this->generarYGuardarPdf($uuid);
            if ($urlRelativa) {
                $rutaArchivo = $dirPdfs . basename($urlRelativa);
            } else {
                http_response_code(500); echo "Error al generar el PDF."; return;
            }
        }

        $nombreArchivo = basename($rutaArchivo);
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $nombreArchivo . '"');
        header('Content-Length: ' . filesize($rutaArchivo));
        ob_clean();
        flush();
        readfile($rutaArchivo);
    }

    private function mejorarTextoConIA(string $textoOriginal): string {
        if (strlen($textoOriginal) < 3 || empty($textoOriginal)) return $textoOriginal;
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
        $prompt = "Eres un ingeniero experto redactando presupuestos. Reescribe esta tarea para que suene técnica y formal sin ser demasiado exagerado, el objetivo final es un cliente común. NO uses la palabra 'suministro' si es solo mano de obra. Entrada: '$textoOriginal'. Salida (SOLO EL TEXTO):";
        $data = ['contents' => [['parts' => [['text' => $prompt]]]], 'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 8000]];
        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            if ($response === false) { curl_close($ch); return $textoOriginal; }
            curl_close($ch);
            $json = json_decode($response, true);
            return trim($json['candidates'][0]['content']['parts'][0]['text'] ?? $textoOriginal);
        } catch (Exception $e) { return $textoOriginal; }
    }

    private function generarNombreArchivoIA(array $materiales, string $nombreCliente): string {
        if (empty($materiales)) { return preg_replace('/[^A-Za-z0-9]/', '', $nombreCliente); }
        $lista = ""; $i = 0;
        foreach($materiales as $m) { $lista .= $m['nombre'] . ", "; $i++; if($i > 5) break; }
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
        $prompt = "Analiza esta lista de materiales: [$lista]. Genera un nombre de archivo CORTO (max 5 palabras) usando guiones bajos que describa el trabajo. Ejemplo: Instalacion_CCTV_Norte. NO incluyas .pdf. Responde SOLO el nombre.";
        $data = ['contents' => [['parts' => [['text' => $prompt]]]], 'generationConfig' => ['temperature' => 0.5, 'maxOutputTokens' => 1000]];
        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            curl_close($ch);
            $json = json_decode($response, true);
            $nombreGenerado = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($nombreGenerado) { return preg_replace('/[^A-Za-z0-9_]/', '', trim($nombreGenerado)); }
            return "Proyecto_Electrico";
        } catch (Exception $e) { return "Cotizacion_Generica"; }
    }
}
?>