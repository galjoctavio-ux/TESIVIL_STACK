<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/ResendService.php';
require_once __DIR__ . '/../Services/GeminiService.php';
require_once __DIR__ . '/PdfController.php';

class CotizacionController {
    private CalculosService $calculosService;
    private GeminiService $geminiService;
    private PDO $db;

    public function __construct() {
        $this->calculosService = new CalculosService();
        $this->geminiService = new GeminiService();
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // ==========================================
    // 1. GESTIÓN PRINCIPAL (Guardar y Crear)
    // ==========================================

    public function guardarCotizacion(): void {
        // AUMENTAR EL TIEMPO LÍMITE DE EJECUCIÓN A 5 MINUTOS (Vital para PDFs)
        set_time_limit(300);

        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        if (!isset($input['items']) || !isset($input['mano_de_obra']) || !isset($input['tecnico_id']) || empty($input['cliente_email']) || !isset($input['caso_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos obligatorios (items, mo, tecnico, email o caso_id)']);
            return;
        }
        
        if(empty($input['mano_de_obra'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Debe agregar mano de obra']);
            return;
        }

        $this->db->beginTransaction();
        try {
            $resultado = $this->calculosService->calcularCotizacion($input['items'], $input['mano_de_obra']);
            $totales = $resultado['totales'];

            // Estimación de IA para auditoría
            $itemsSimples = array_map(fn($item) => ['nombre' => $item['nombre'], 'cantidad' => $item['cantidad']], $resultado['desglose_items']);
            $estimacionIA = 0.0;
            try {
                $estimacionIA = $this->geminiService->estimarCostoProyecto($itemsSimples, floatval($totales['horas_totales_calculadas']));
            } catch (Exception $e) {
                error_log("Warning: IA audit failed but we continue. " . $e->getMessage());
            }

            // Reglas de negocio
            $reglas = $this->calculosService->validarReglasFinancieras($totales);
            $estado = 'ENVIADA';
            $razonDetencion = null;
            if (!$reglas['aprobado']) {
                $estado = 'PENDIENTE_AUTORIZACION';
                $razonDetencion = "REGLAS NEGOCIO: " . $reglas['razones'];
            } elseif ($estimacionIA > 0 && $totales['total_venta'] < ($estimacionIA * 0.60)) {
                $estado = 'PENDIENTE_AUTORIZACION';
                $razonDetencion = "ALERTA IA: Precio muy bajo. (IA: $" . number_format($estimacionIA, 2) . " vs Técnico: $" . number_format($totales['total_venta'], 2) . ")";
            }

            $clienteNombre = trim($input['cliente_nombre']) ?: 'Público en General';
            $clienteData = [
                'nombre' => $clienteNombre,
                'direccion' => $input['cliente_direccion'] ?? '',
                'email' => $input['cliente_email'],
                'telefono' => $input['cliente_telefono'] ?? null
            ];

            //$nombreAsesorDesdeBD = $this->calculosService->obtenerNombreUsuarioPorId($input['tecnico_id']);
           $tecnicoNombreFinal = $input['tecnico_nombre'] ?? 'Asesor de Servicio'; // <-- USAR DIRECTO EL INPUT
            
            $guardadoResult = $this->calculosService->guardarCotizacion(
                $resultado,
                $input['tecnico_id'],
                $tecnicoNombreFinal,
                $clienteData,
                $estado,
                $razonDetencion,
                $estimacionIA,
                $input['caso_id']
            );

            // Manejo de UUID e ID retornados
            $uuid = is_array($guardadoResult) ? $guardadoResult['uuid'] : $guardadoResult; 
            $cotizacionId = is_array($guardadoResult) ? ($guardadoResult['cotizacionId'] ?? null) : null;

            $pdfUrl = null;
            if ($uuid) {
                $pdfController = new PdfController();
                $pdfUrl = $pdfController->generarYGuardarPdf($uuid);
                if ($pdfUrl) {
                    $this->calculosService->actualizarUrlPdf($uuid, $pdfUrl);
                } else {
                    error_log("Error: Could not generate or save PDF for UUID: " . $uuid);
                }
            }

            $this->db->commit();

            // --- INICIO AGREGADO NOTIFICACIÓN PUSH ---
            // Le avisamos al técnico que su cotización ya se procesó y se generó el PDF
            try {
                $msgPush = "Cliente: " . ($clienteData['nombre'] ?? 'Desconocido');
                $this->notificarTecnicoNode(
                    $input['tecnico_id'], // El email del técnico viene aquí
                    "✅ Cotización Exitosa", 
                    $msgPush,
                    "/historial" // URL a donde quieres que vaya al hacer click
                );
            } catch (Exception $e) {
                error_log("No se pudo enviar push: " . $e->getMessage());
            }
            // --- FIN AGREGADO ---

            if ($estado === 'ENVIADA') {
                $resendService = new ResendService();
                $idParaEnvio = $cotizacionId ? (int)$cotizacionId : null; // Aseguramos que sea int o null
                $resendService->enviarCotizacion($uuid, $input['cliente_email'], $clienteData['nombre'], $idParaEnvio);
                $mensajeRespuesta = 'Cotización enviada correctamente al cliente.';
            } else {
                $mensajeRespuesta = '🛑 Cotización DETENIDA para revisión administrativa. Razón: ' . $razonDetencion;
            }

            echo json_encode(['status' => 'success', 'message' => $mensajeRespuesta, 'estado_final' => $estado, 'uuid' => $uuid, 'pdf_url' => $pdfUrl]);

        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
        }
    }

    public function crearCotizacion(): void {
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);
        if (!isset($input['items']) || !isset($input['mano_de_obra'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos: items o mano_de_obra']);
            return;
        }
        try {
            $resultado = $this->calculosService->calcularCotizacion($input['items'], $input['mano_de_obra']);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $resultado]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ==========================================
    // 2. GESTIÓN DE RECURSOS E INVENTARIO
    // ==========================================

    public function listarRecursos(): void {
        try {
            $recursos = $this->calculosService->obtenerRecursosActivos();
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $recursos]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function nuevoRecurso(): void {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['precio_total'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta el campo precio_total']);
            return;
        }
        $precioTotal = floatval($input['precio_total']);

        if (empty($input['nombre']) || empty($input['unidad'])) {
             http_response_code(400);
             echo json_encode(['error' => 'Faltan datos (nombre, unidad)']);
             return;
        }
        try {
            $estatus = $input['estatus'] ?? 'PENDIENTE_TECNICO';
            $nuevoRecurso = $this->calculosService->crearNuevoRecurso($input['nombre'], $input['unidad'], $precioTotal, $estatus);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $nuevoRecurso]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function listarInventarioAdmin(): void {
        try {
            $recursos = $this->calculosService->obtenerInventarioTotal();
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $recursos]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function aprobarRecurso(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $this->calculosService->aprobarRecurso((int)$input['id']);
            echo json_encode(['status' => 'success', 'message' => 'Aprobado']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function editarRecurso(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id']) || empty($input['nombre']) || !isset($input['precio']) || !isset($input['tiempo']) || empty($input['unidad'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos incompletos']); return;
        }
        try {
            $this->calculosService->actualizarRecurso((int)$input['id'], $input['nombre'], floatval($input['precio']), (int)$input['tiempo'], $input['unidad']);
            echo json_encode(['status' => 'success', 'message' => 'Actualizado']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function eliminarRecurso(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $this->calculosService->eliminarRecurso((int)$input['id']);
            echo json_encode(['status' => 'success', 'message' => 'Eliminado']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ==========================================
    // 3. GESTIÓN DE ESTADOS Y ACCIONES (Admin)
    // ==========================================

    public function listarCotizacionesAdmin(): void {
        try {
            $cotizaciones = $this->calculosService->obtenerListadoCotizaciones();
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $cotizaciones]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function exportarMaterialesTxt(): void {
        if (empty($_GET['id'])) {
            http_response_code(400); echo "Error: Falta ID."; return;
        }
        try {
            $texto = $this->calculosService->obtenerListaMaterialesExportar((int)$_GET['id']);
            header('Content-Type: text/plain; charset=utf-8');
            echo $texto;
        } catch (Exception $e) {
            http_response_code(500); echo "Error: " . $e->getMessage();
        }
    }

    public function autorizarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $this->calculosService->actualizarEstadoCotizacion((int)$input['id'], 'ENVIADA');
            $datos = $this->calculosService->obtenerDatosEnvio((int)$input['id']);
            if ($datos) {
                $resend = new ResendService();
                $resend->enviarCotizacion($datos['uuid'], $datos['cliente_email'], $datos['cliente_nombre']);
            }
            echo json_encode(['status' => 'success', 'message' => 'Cotización autorizada y enviada al cliente.']);
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => 'Error interno: ' . $e->getMessage()]);
        }
    }

    // Método alias simple (por compatibilidad de rutas)
    public function authorize(int $id): void {
        try {
            $this->calculosService->actualizarEstadoCotizacion($id, 'autorizada'); // 'autorizada' vs 'ENVIADA' depende de tu lógica de negocio
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => 'Cotización autorizada']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error interno: ' . $e->getMessage()]);
        }
    }

    public function rechazarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $this->calculosService->actualizarEstadoCotizacion((int)$input['id'], 'RECHAZADA');
            echo json_encode(['status' => 'success', 'message' => 'Cotización marcada como rechazada.']);
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function agendarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); 
             echo json_encode(['error' => 'Falta ID de la cotización']); 
             return;
        }

        try {
            $this->calculosService->actualizarEstadoCotizacion((int)$input['id'], 'AGENDADA');
            echo json_encode([
                'status' => 'success', 
                'message' => 'Cotización marcada como AGENDADA exitosamente.'
            ]);
        } catch (Exception $e) {
            http_response_code(500); 
            echo json_encode(['error' => 'Error al agendar: ' . $e->getMessage()]);
        }
    }

    // ==========================================
    // 4. CLONADO Y EDICIÓN (Power Clone)
    // ==========================================

    public function powerCloneCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id_original']) || empty($input['items']) || empty($input['mano_de_obra'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos para el Power Clone']);
            return;
        }

        try {
            $res = $this->calculosService->powerCloneCotizacion(
                (int)$input['id_original'],
                $input['items'],
                $input['mano_de_obra'],
                $input['cliente_email'],
                $input['cliente_nombre']
            );

            if (!empty($res['uuid'])) {
                try {
                    $pdfController = new PdfController();
                    $pdfUrl = $pdfController->generarYGuardarPdf($res['uuid']);
                    if ($pdfUrl) {
                        $this->calculosService->actualizarUrlPdf($res['uuid'], $pdfUrl);
                    }
                } catch (Exception $e) {
                    error_log("Error generando PDF para clon: " . $e->getMessage());
                }

                $resendService = new ResendService();
                $resendService->enviarCotizacion($res['uuid'], $input['cliente_email'], $input['cliente_nombre']);
            }

            echo json_encode(['status' => 'success', 'data' => $res]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en Power Clone: ' . $e->getMessage()]);
        }
    }

    public function clonarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $res = $this->calculosService->clonarCotizacion((int)$input['id']);
            echo json_encode(['status' => 'success', 'data' => $res]);
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function actualizarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id']) || !isset($input['items']) || !isset($input['mano_de_obra'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos para actualizar']);
            return;
        }
        try {
            $this->calculosService->actualizarContenidoCotizacion((int)$input['id'], $input['items'], $input['mano_de_obra'], $input['cliente_email'], $input['cliente_nombre'] ?? 'Cliente');
            echo json_encode(['status' => 'success', 'message' => 'Cotización actualizada correctamente.']);
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function obtenerDetalleEdicion(): void {
        if (empty($_GET['id'])) { 
            http_response_code(400); echo json_encode(['error' => 'Falta ID']); return; 
        }
        try {
            $datos = $this->calculosService->obtenerDetalleCotizacionPorId((int)$_GET['id']);
            if ($datos) {
                echo json_encode(['status' => 'success', 'data' => $datos]);
            } else {
                http_response_code(404); echo json_encode(['error' => 'No encontrada']);
            }
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ==========================================
    // 5. FINALIZACIÓN Y UTILIDADES
    // ==========================================

    public function finalizarProyecto(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id']) || !isset($input['gasto_material']) || !isset($input['gasto_mo'])) {
             http_response_code(400); 
             echo json_encode(['error' => 'Faltan datos: id, gasto_material o gasto_mo']); 
             return;
        }
        try {
            $this->calculosService->finalizarProyecto((int)$input['id'], floatval($input['gasto_material']), floatval($input['gasto_mo']));
            echo json_encode(['status' => 'success', 'message' => 'Proyecto cerrado y utilidad calculada.']);
        } catch (Exception $e) {
            http_response_code(500); 
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function reenviarCorreo(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $datos = $this->calculosService->obtenerDatosEnvio((int)$input['id']);
            if ($datos) {
                $resend = new ResendService();
                $resend->enviarCotizacion($datos['uuid'], $datos['cliente_email'], $datos['cliente_nombre'], (int)$input['id']);
                echo json_encode(['status' => 'success', 'message' => 'Correo reenviado exitosamente a ' . $datos['cliente_email']]);
            } else {
                http_response_code(404); echo json_encode(['error' => 'Cotización no encontrada.']);
            }
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => 'Error al enviar: ' . $e->getMessage()]);
        }
    }

    public function obtenerConteosPorTecnico(): void {
        if (empty($_GET['tecnico_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta el parámetro tecnico_id']);
            return;
        }
        try {
            $conteos = $this->calculosService->contarCotizacionesPorCaso($_GET['tecnico_id']);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $conteos]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function aplicarDescuento(): void {
         // Implementación placeholder para rutas existentes
         http_response_code(501);
         echo json_encode(['error' => 'Not implemented yet']);
    }

    // ==========================================
    // 6. AUXILIAR: PUSH NOTIFICATIONS (PHP -> NODE)
    // ==========================================
    private function notificarTecnicoNode(string $emailTecnico, string $titulo, string $mensaje, string $urlDestino = '/'): void {
        // 1. Define la URL de tu servidor Node.js
        // Asegúrate de que este puerto (ej. 3000 o 4000) sea el correcto donde corre tu Node.js
        $urlNode = 'http://localhost:3001/lete/api/notifications/send-by-email'; 

        $data = [
            'email' => $emailTecnico,
            'payload' => [
                'title' => $titulo,
                'body'  => $mensaje,
                'url'   => $urlDestino
            ]
        ];

        // 2. Iniciar cURL para hacer la petición POST
        $ch = curl_init($urlNode);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            // 'x-api-key: TU_CLAVE_SECRETA' // Opcional: si proteges tu endpoint de Node
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 2); // Timeout corto para no frenar a PHP si Node tarda

        // 3. Ejecutar (No nos importa mucho la respuesta, solo que se envíe)
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log("Error enviando notificación a Node: " . curl_error($ch));
        }
        curl_close($ch);
    }
} // Fin de la clase CotizacionController



?>