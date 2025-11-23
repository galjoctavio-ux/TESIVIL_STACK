<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/ResendService.php';
require_once __DIR__ . '/../Services/GeminiService.php';
require_once __DIR__ . '/PdfController.php'; // Incluimos el controlador de PDF

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

    // 2. GUARDAR Y ENVIAR
    public function guardarCotizacion(): void {
         // AUMENTAR EL TIEMPO LÍMITE DE EJECUCIÓN A 5 MINUTOS
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

            $itemsSimples = array_map(fn($item) => ['nombre' => $item['nombre'], 'cantidad' => $item['cantidad']], $resultado['desglose_items']);
            $estimacionIA = 0.0;
            try {
                $estimacionIA = $this->geminiService->estimarCostoProyecto($itemsSimples, floatval($totales['horas_totales_calculadas']));
            } catch (Exception $e) {
                error_log("Warning: IA audit failed but we continue. " . $e->getMessage());
            }

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

            $nombreAsesorDesdeBD = $this->calculosService->obtenerNombreUsuarioPorId($input['tecnico_id']);
            $tecnicoNombreFinal = $input['tecnico_nombre'] ?? 'Asesor de Servicio';
            
            $guardadoResult = $this->calculosService->guardarCotizacion(
                $resultado,
                $input['tecnico_id'],
                $tecnicoNombreFinal,
                $clienteData,
                $estado,
                $razonDetencion,
                $estimacionIA,
                $input['caso_id'] // <-- PASAR EL ID DEL CASO
            );

            $uuid = $guardadoResult['uuid'];
            $cotizacionId = $guardadoResult['cotizacionId'];

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

            if ($estado === 'ENVIADA') {
                $resendService = new ResendService();
                $resendService->enviarCotizacion($uuid, $input['cliente_email'], $clienteData['nombre'], $cotizacionId);
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

    // Mantenemos los demás métodos intactos
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

        // --- LÓGICA MODIFICADA ---
        // Leemos el 'precio_total' que envía la PWA
        if (!isset($input['precio_total'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta el campo precio_total']);
            return;
        }
        $precioTotal = floatval($input['precio_total']);
        // --- FIN LÓGICA MODIFICADA ---

        if (empty($input['nombre']) || empty($input['unidad'])) {
            // ... (el resto de tu validación)
        }
        try {
            $estatus = $input['estatus'] ?? 'PENDIENTE_TECNICO';
            $nuevoRecurso = $this->calculosService->crearNuevoRecurso($input['nombre'], $input['unidad'], $precioTotal, $estatus); // <-- CAMBIADO
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
        if (empty($input['id']) || empty($input['nombre']) || !isset($input['precio']) || !isset($input['tiempo']) || empty($input['unidad'])) { // Añadido unidad
            http_response_code(400);
            echo json_encode(['error' => 'Datos incompletos']); return;
        }
        try {
            $this->calculosService->actualizarRecurso((int)$input['id'], $input['nombre'], floatval($input['precio']), (int)$input['tiempo'], $input['unidad']); // Añadido unidad
            echo json_encode(['status' => 'success', 'message' => 'Actualizado']);
        } catch (Exception $e) { /* ... */ }
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

    public function agendarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); 
             echo json_encode(['error' => 'Falta ID de la cotización']); 
             return;
        }

        try {
            // Cambiamos el estatus a AGENDADA. 
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

    public function rechazarCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $this->calculosService->actualizarEstadoCotizacion((int)$input['id'], 'RECHAZADA');
            echo json_encode(['status' => 'success', 'message' => 'Cotización marcada como rechazada.']);
        } catch (Exception $e) {
            http_response_code(500); 
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function finalizarProyecto(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
            http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $gastoMaterial = isset($input['gasto_material']) ? floatval($input['gasto_material']) : 0;
            $gastoMo = isset($input['gasto_mo']) ? floatval($input['gasto_mo']) : 0;

            $this->calculosService->finalizarProyecto((int)$input['id'], $gastoMaterial, $gastoMo);
            echo json_encode(['status' => 'success', 'message' => 'Proyecto cerrado y utilidad calculada.']);
        } catch (Exception $e) {
            http_response_code(500); 
            echo json_encode(['error' => $e->getMessage()]);
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

    public function powerCloneCotizacion(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            // Asumiendo que existe este método en CalculosService, basado en rutas
            $res = $this->calculosService->clonarCotizacion((int)$input['id']); 
            // Nota: Si tienes un método específico powerClone en el service, úsalo aquí.
            // Por ahora reutilizo clonarCotizacion para mantener la sintaxis válida.
            echo json_encode(['status' => 'success', 'data' => $res]);
        } catch (Exception $e) {
            http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
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
    
    public function exportarMaterialesTxt(): void {
         // Implementación placeholder si faltaba en tu archivo original, 
         // pero requerida por routes.php
         http_response_code(501);
         echo json_encode(['error' => 'Not implemented yet']);
    }

    public function aplicarDescuento(): void {
         // Implementación placeholder
         http_response_code(501);
         echo json_encode(['error' => 'Not implemented yet']);
    }
    
    public function autorizarCotizacion(): void {
         // Implementación placeholder
         http_response_code(501);
         echo json_encode(['error' => 'Not implemented yet']);
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

    public function listarCotizacionesAdmin(): void {
        try {
            // Llamamos al servicio que ya tiene la consulta SQL lista
            $cotizaciones = $this->calculosService->obtenerListadoCotizaciones();
            
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $cotizaciones]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
?>