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
        // Incluir el bootstrap para cargar las variables de entorno
        require_once __DIR__ . '/../../config/bootstrap.php';
        if (!isset($_ENV['GEMINI_API_KEY'])) {
            throw new \Exception("Error: La variable de entorno GEMINI_API_KEY no está configurada.");
        }
        $this->apiKey = $_ENV['GEMINI_API_KEY'];
        $this->service = new CalculosService();
        $this->gemini = new GeminiService();
    }

    // --- 1. MEJORA DE TEXTO (IA GEMINI 2.5) ---
    private function mejorarTextoConIA(string $textoOriginal): string {
        if (strlen($textoOriginal) < 3 || empty($textoOriginal)) return $textoOriginal;

        // Usamos el modelo más avanzado del segundo archivo
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
        
        $prompt = "Eres un ingeniero experto redactando presupuestos. Reescribe esta tarea para que suene técnica y formal sin ser demasiado exagerado, el objetivo final es un cliente común. NO uses la palabra 'suministro' si es solo mano de obra. Entrada: '$textoOriginal'. Salida (SOLO EL TEXTO):";

        $data = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 8000]
        ];

        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            
            $response = curl_exec($ch);
            
            if ($response === false) {
                curl_close($ch);
                return $textoOriginal;
            }
            
            curl_close($ch);
            $json = json_decode($response, true);
            return trim($json['candidates'][0]['content']['parts'][0]['text'] ?? $textoOriginal);

        } catch (Exception $e) {
            return $textoOriginal; 
        }
    }

    // --- 2. NOMBRE DE ARCHIVO INTELIGENTE (IA) ---
    private function generarNombreArchivoIA(array $materiales, string $nombreCliente): string {
        if (empty($materiales)) {
            return preg_replace('/[^A-Za-z0-9]/', '', $nombreCliente);
        }

        // Resumen breve para la IA
        $lista = "";
        $i = 0;
        foreach($materiales as $m) {
            $lista .= $m['nombre'] . ", ";
            $i++;
            if($i > 5) break;
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
        
        $prompt = "Analiza esta lista de materiales: [$lista]. Genera un nombre de archivo CORTO (max 5 palabras) usando guiones bajos que describa el trabajo. Ejemplo: Instalacion_CCTV_Norte. NO incluyas .pdf. Responde SOLO el nombre.";

        $data = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['temperature' => 0.5, 'maxOutputTokens' => 1000]
        ];

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

            if ($nombreGenerado) {
                return preg_replace('/[^A-Za-z0-9_]/', '', trim($nombreGenerado));
            }
            return "Proyecto_Electrico"; 
        } catch (Exception $e) {
            return "Cotizacion_Generica";
        }
    }

    // --- 3. GENERACIÓN DEL PDF (FUSIONADO) ---
    public function generarPdf(string $uuid): void {
        $datos = $this->service->obtenerCotizacionPorUuid($uuid);
        
        if (!$datos) {
            http_response_code(404); echo "Cotización no encontrada"; return;
        }

        $h = $datos['header'];
        $idCotizacion = (int)$h['id'];

        // --- A. SISTEMA DE CACHÉ (Del Archivo 1, Mejorado) ---
        // Definir directorio de guardado
        $dirPdfs = __DIR__ . '/../../public/pdfs/';
        if (!is_dir($dirPdfs)) {
            mkdir($dirPdfs, 0777, true);
        }

        // Buscamos si YA existe un archivo para este ID (C123_*.pdf)
        // Esto evita llamar a la IA para generar el nombre si el archivo ya existe
        $archivosExistentes = glob($dirPdfs . "C{$idCotizacion}_*.pdf");

        if (!empty($archivosExistentes)) {
            $rutaArchivo = $archivosExistentes[0]; // Tomamos el primero encontrado
            $nombreArchivo = basename($rutaArchivo);

            // Servir directo del disco (Ahorro de IA y recursos)
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="' . $nombreArchivo . '"');
            header('Content-Length: ' . filesize($rutaArchivo));
            readfile($rutaArchivo);
            return;
        }

        // --- B. SI NO EXISTE, GENERAMOS TODO (Del Archivo 2) ---
        
        $itemsMateriales = $datos['items_materiales']; 
        $itemsMO = $datos['items_mo'];             
        $config = $datos['global_config'];

        // Datos Empresa y Cliente
        $empresaDir = "Av. Sebastian Bach 4978, Prados Guadalupe, Zapopan, Jal.";
        $empresaTel = "33 2639 5038";
        $empresaEmail = "contacto-lete@tesivil.com";
        $empresaWeb = "www.tesivil.com/lete";
        $nombreIngeniero = !empty($h['tecnico_nombre']) ? $h['tecnico_nombre'] : 'Ingeniero de Servicio';
        $fecha = date("d/m/Y", strtotime($h['fecha_creacion']));
        $datosBancariosHtml = nl2br($config['datos_bancarios'] ?? 'Solicitar datos bancarios.');

        // Cálculos (Lógica híbrida para respetar margen)
        $matCD = floatval($h['total_materiales_cd']);
        $moCD = floatval($h['total_mano_obra_cd']);
        $subtotalReal = floatval($h['subtotal_venta']);
        $sumaCD = $matCD + $moCD;
        
        // Factor para inflar costos directos y llegar al precio de venta (Lógica Archivo 1)
        $factor = ($sumaCD > 0) ? ($subtotalReal / $sumaCD) : 1;
        
        $matCliente = $matCD * $factor;
        // El resto se asigna a Mano de Obra para cuadrar el subtotal
        $moCliente = $subtotalReal - $matCliente; 

        $iva = floatval($h['monto_iva']);
        $total = floatval($h['precio_venta_final']);
        $anticipo = floatval($h['monto_anticipo']);

        // Manejo de Descuentos (Lógica Archivo 2)
        $tieneDescuento = isset($h['descuento_pct']) && floatval($h['descuento_pct']) > 0;
        $descuentoMonto = 0;
        $subtotalSinDescuento = $subtotalReal;
        
        if ($tieneDescuento) {
            $subtotalOriginal = $subtotalReal / (1 - (floatval($h['descuento_pct'])/100));
            $descuentoMonto = $subtotalOriginal - $subtotalReal;
            $subtotalSinDescuento = $subtotalOriginal;
        }

        // Configuración DomPDF
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true); 
        $dompdf = new Dompdf($options);

        // HTML Template (Estilo Avanzado del Archivo 2)
        $html = '
        <html>
        <head>
            <style>
                body { font-family: "Helvetica", sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
                .header-table { width: 100%; margin-bottom: 30px; border-bottom: 3px solid #0056b3; padding-bottom: 15px; }
                .logo-img { max-height: 70px; }
                .empresa-info { text-align: right; font-size: 9px; color: #666; }
                .empresa-info strong { font-size: 11px; color: #0056b3; }
                
                .cliente-box { background-color: #f8f9fa; border-left: 4px solid #0056b3; padding: 15px; margin-bottom: 25px; border-radius: 0 5px 5px 0; }
                .cliente-label { font-weight: bold; color: #0056b3; font-size: 10px; text-transform: uppercase; margin-bottom: 3px; }
                .cliente-dato { font-size: 12px; margin-bottom: 8px; }
                
                .section-header { background-color: #0056b3; color: white; padding: 8px 10px; font-weight: bold; font-size: 10px; text-transform: uppercase; margin-top: 20px; border-radius: 4px 4px 0 0; }
                
                .items-table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; border-top: none; }
                .items-table th { display: none; } 
                .items-table td { border-bottom: 1px solid #eee; padding: 8px 10px; vertical-align: top; }
                .items-table tr:last-child td { border-bottom: none; }
                .col-cant { width: 10%; text-align: center; font-weight: bold; color: #555; }
                .col-desc { width: 90%; }
                
                .footer-grid { width: 100%; display: table; margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; }
                .footer-left { display: table-cell; width: 60%; vertical-align: top; padding-right: 20px; }
                .footer-right { display: table-cell; width: 40%; vertical-align: top; }
                
                .bancos-card { border: 1px dashed #ccc; padding: 15px; background: #fffdf0; border-radius: 5px; font-size: 10px; }
                .totales-table { width: 100%; }
                .totales-table td { padding: 5px 0; text-align: right; }
                .lbl { font-weight: bold; color: #555; }
                .num { color: #333; }
                .total-row { font-size: 15px; font-weight: bold; color: #0056b3; border-top: 2px solid #0056b3; padding-top: 10px !important; }
                .anticipo-badge { background: #0056b3; color: white; padding: 5px 10px; border-radius: 20px; font-weight: bold; font-size: 11px; display: inline-block; margin-top: 10px; }
                
                .watermark { position: fixed; bottom: 100px; left: 20%; width: 60%; text-align: center; opacity: 0.05; font-size: 80px; font-weight: bold; color: #000; transform: rotate(-45deg); z-index: -1; }
                .legal-footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ddd; padding: 10px 0; }
            </style>
        </head>
        <body>
            <div class="watermark">PRESUPUESTO</div>

            <table class="header-table">
                <tr>
                    <td valign="top"><img src="'. $config['logo_url'] .'" class="logo-img"></td>
                    <td valign="top" class="empresa-info">
                        <strong>LUZ EN TU ESPACIO</strong><br>
                        '. $empresaDir .'<br>
                        Tel: '. $empresaTel .'<br>
                        Email: '. $empresaEmail .'<br>
                        '. $empresaWeb .'<br><br>
                        <span style="font-size: 12px; color: #333;">COTIZACIÓN <strong>#'. $h['id'] .'</strong></span><br>
                        Fecha: '. $fecha .'
                    </td>
                </tr>
            </table>

            <div class="cliente-box">
                <table width="100%">
                    <tr>
                        <td width="60%">
                            <div class="cliente-label">Cliente</div>
                            <div class="cliente-dato" style="font-size: 14px; font-weight: bold;">'. $h['cliente_nombre'] .'</div>
                            <div class="cliente-dato">'. $h['direccion_obra'] .'</div>
                        </td>
                        <td width="40%" style="border-left: 1px solid #ddd; padding-left: 20px;">
                            <div class="cliente-label">Asesor Asignado</div>
                            <div class="cliente-dato">'. $nombreIngeniero .'</div>
                            <div class="cliente-dato"><small>Dudas técnicas directas con el asesor</small></div>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="section-header">1. Suministro de Materiales</div>
            <table class="items-table">
                <tbody>';
        
        if (empty($itemsMateriales)) {
            $html .= '<tr><td colspan="2" style="padding:15px; text-align:center; color:#777; font-style:italic;">No aplica suministro de materiales para este proyecto.</td></tr>';
        } else {
            foreach ($itemsMateriales as $item) {
                $html .= '
                    <tr>
                        <td class="col-cant">'. floatval($item['cantidad']) .' <span style="font-size:9px; font-weight:normal;">'. $item['unidad'] .'</span></td>
                        <td class="col-desc">
                            <strong>'. $item['nombre'] .'</strong>
                        </td>
                    </tr>';
            }
        }
        $html .= '</tbody></table>

            <div class="section-header">2. Servicios y Mano de Obra Especializada</div>
            <table class="items-table">
                <tbody>';

        foreach ($itemsMO as $tarea) {
            // IA: Mejorar texto (Ejecución costosa, pero necesaria solo la primera vez gracias al caché)
            $descMejorada = $this->mejorarTextoConIA($tarea['descripcion']);
            
            $html .= '
                    <tr>
                        <td class="col-cant" style="width: 15%; font-size: 9px;">'. floatval($tarea['horas']) .' hrs est.</td>
                        <td class="col-desc" style="width: 85%;">'. $descMejorada .'</td>
                    </tr>';
        }
        $html .= '</tbody></table>

            <div class="footer-grid">
                <div class="footer-left">
                    <div class="bancos-card">
                        <strong style="color:#0056b3;">INFORMACIÓN BANCARIA PARA ANTICIPO</strong><br><br>
                        '. $datosBancariosHtml .'
                        <br><br>
                        <em>* Una vez realizado el pago, favor de enviar comprobante vía WhatsApp.</em>
                    </div>
                </div>
                <div class="footer-right">
                    <table class="totales-table">
                        <tr><td class="lbl">Materiales (Est.):</td><td class="num">$'. number_format($matCliente, 2) .'</td></tr>
                        <tr><td class="lbl">Mano de Obra:</td><td class="num">$'. number_format($moCliente, 2) .'</td></tr>';
        
        if ($tieneDescuento) {
            $html .= '<tr><td class="lbl" style="border-top:1px solid #eee;">Subtotal Lista:</td><td class="num" style="border-top:1px solid #eee;">$'. number_format($subtotalSinDescuento, 2) .'</td></tr>';
            $html .= '<tr><td class="lbl" style="color:#28a745;">Descuento ('. floatval($h['descuento_pct']) .'%):</td><td class="num" style="color:#28a745;">-$'. number_format($descuentoMonto, 2) .'</td></tr>';
        }

        $html .= '
                        <tr><td class="lbl" style="border-top:1px solid #eee; padding-top:5px;">Subtotal:</td><td class="num" style="border-top:1px solid #eee; padding-top:5px;">$'. number_format($subtotalReal, 2) .'</td></tr>
                        <tr><td class="lbl">IVA (16%):</td><td class="num">$'. number_format($iva, 2) .'</td></tr>
                        <tr><td class="lbl total-row">TOTAL NETO:</td><td class="num total-row">$'. number_format($total, 2) .'</td></tr>
                    </table>
                    
                    <div style="text-align: right; margin-top: 15px;">
                        <div class="anticipo-badge">ANTICIPO: $'. number_format($anticipo, 2) .'</div>
                        <div style="font-size: 9px; margin-top: 5px; color: #666;">Resto contra entrega: $'. number_format($total - $anticipo, 2) .'</div>
                    </div>
                </div>
            </div>

            <div class="legal-footer">
                '. $empresaWeb .' | '. $empresaDir .' | Este documento es una propuesta comercial y tiene una vigencia limitada.
            </div>
        </body>
        </html>';

        // --- C. RENDERIZADO Y GUARDADO (FUSIONADO) ---
        
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        ob_clean(); // Limpieza de buffer vital para evitar errores en el PDF
        
        // IA: Generar nombre (Ejecutado al final para guardar con nombre bonito)
        $nombreParteIA = $this->generarNombreArchivoIA($itemsMateriales, $h['cliente_nombre']);
        $nombreFinal = "C{$h['id']}_{$nombreParteIA}.pdf";
        
        // GUARDAMOS EN DISCO (Funcionalidad del Archivo 1 recuperada)
        $rutaGuardado = $dirPdfs . $nombreFinal;
        $output = $dompdf->output();
        file_put_contents($rutaGuardado, $output);

        // ENVIAMOS AL NAVEGADOR
        $dompdf->stream($nombreFinal, ["Attachment" => false]);
    }
}
?>
