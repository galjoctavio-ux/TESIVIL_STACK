<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/CalculosService.php';
require_once __DIR__ . '/../Services/ResendService.php';
require_once __DIR__ . '/../Services/GeminiService.php';
require_once __DIR__ . '/PdfController.php'; // Incluimos el controlador de PDF

class CotizacionController {
    private CalculosService $calculosService;
    private GeminiService $geminiService;

    public function __construct() {
        $this->calculosService = new CalculosService();
        $this->geminiService = new GeminiService();
    }

    // 2. GUARDAR Y ENVIAR
    public function guardarCotizacion(): void {
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        if (!isset($input['items']) || !isset($input['mano_de_obra']) || !isset($input['tecnico_id']) || empty($input['cliente_email'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos obligatorios']);
            return;
        }
        
        if(empty($input['mano_de_obra'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Debe agregar mano de obra']);
            return;
        }

        try {
            // A. Cálculo Matemático
            $resultado = $this->calculosService->calcularCotizacion(
                $input['items'],
                $input['mano_de_obra']
            );
            $totales = $resultado['totales'];

            // B. Estimación IA
            $itemsSimples = array_map(function($item) {
                return ['nombre' => $item['nombre'], 'cantidad' => $item['cantidad']];
            }, $resultado['desglose_items']);

            $estimacionIA = 0.0;
            try {
                $estimacionIA = $this->geminiService->estimarCostoProyecto(
                    $itemsSimples, 
                    floatval($totales['horas_totales_calculadas'])
                );
            } catch (Exception $e) {
                error_log("Warning: La auditoría de IA falló, pero continuamos. " . $e->getMessage());
            }

            // C. Filtro de Seguridad
            $reglas = $this->calculosService->validarReglasFinancieras($totales);
            $estado = 'ENVIADA';
            $razonDetencion = null;

            if (!$reglas['aprobado']) {
                $estado = 'PENDIENTE_AUTORIZACION';
                $razonDetencion = "REGLAS NEGOCIO: " . $reglas['razones'];
            }
            elseif ($estimacionIA > 0 && $totales['total_venta'] < ($estimacionIA * 0.60)) {
                $estado = 'PENDIENTE_AUTORIZACION';
                $razonDetencion = "ALERTA IA: Precio muy bajo. (IA: $" . number_format($estimacionIA, 2) . " vs Técnico: $" . number_format($totales['total_venta'], 2) . ")";
            }

            // D. Guardado en Base de Datos
            // Si el nombre del cliente viene vacío, asignamos "Público en General".
            $clienteNombre = (!empty(trim($input['cliente_nombre']))) ? trim($input['cliente_nombre']) : 'Público en General';
            $clienteData = [
                'nombre' => $clienteNombre,
                'direccion' => $input['cliente_direccion'] ?? '',
                'email' => $input['cliente_email']
            ];

            // Obtenemos el nombre real del asesor desde la BD usando el nuevo método.
            $nombreAsesorDesdeBD = $this->calculosService->obtenerNombreUsuarioPorId($input['tecnico_id']);

            // Prioridad para el nombre del asesor: 1) Nombre desde BD, 2) Nombre enviado por el frontend, 3) Un genérico.
            $tecnicoNombreFinal = $nombreAsesorDesdeBD ?? $input['tecnico_nombre'] ?? 'Asesor de Servicio';

            $uuid = $this->calculosService->guardarCotizacion(
                $resultado, 
                $input['tecnico_id'], 
                $tecnicoNombreFinal,
                $clienteData,
                $estado,
                $razonDetencion,
                $estimacionIA
            );

            // --- INICIO DE LA NUEVA LÓGICA DE GENERACIÓN DE PDF ---
            $pdfUrl = null;
            if ($uuid) {
                try {
                    $pdfController = new PdfController();
                    $pdfUrl = $pdfController->generarYGuardarPdf($uuid);

                    if ($pdfUrl) {
                        // Guardamos la URL en la base de datos
                        $this->calculosService->actualizarUrlPdf($uuid, $pdfUrl);
                    } else {
                        error_log("Error: No se pudo generar o guardar el PDF para el UUID: " . $uuid);
                    }
                } catch (Exception $e) {
                    error_log("Excepción al generar PDF: " . $e->getMessage());
                }
            }
            // --- FIN DE LA NUEVA LÓGICA ---

            // E. Acciones Post-Guardado
            $mensajeRespuesta = "";
            if ($estado === 'ENVIADA') {
                $resendService = new ResendService();
                // Asumimos que ResendService usará la pdf_url de la base de datos.
                $resendService->enviarCotizacion($uuid, $input['cliente_email'], $clienteData['nombre']);
                $mensajeRespuesta = 'Cotización enviada correctamente al cliente.';
            } else {
                $mensajeRespuesta = '🛑 Cotización DETENIDA para revisión administrativa. Razón: ' . $razonDetencion;
            }

            echo json_encode([
                'status' => 'success',
                'message' => $mensajeRespuesta,
                'estado_final' => $estado,
                'uuid' => $uuid,
                'pdf_url' => $pdfUrl // Devolvemos la URL al frontend
            ]);

        } catch (Exception $e) {
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
        $precio = isset($input['costo']) ? floatval($input['costo']) : (isset($input['precio']) ? floatval($input['precio']) : 0.0);
        if (empty($input['nombre']) || empty($input['unidad'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre y Unidad son obligatorios']);
            return;
        }
        try {
            $estatus = $input['estatus'] ?? 'PENDIENTE_TECNICO';
            $nuevoRecurso = $this->calculosService->crearNuevoRecurso($input['nombre'], $input['unidad'], $precio, $estatus);
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
        if (empty($input['id']) || empty($input['nombre']) || !isset($input['precio']) || !isset($input['tiempo'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos incompletos']); return;
        }
        try {
            $this->calculosService->actualizarRecurso((int)$input['id'], $input['nombre'], floatval($input['precio']), (int)$input['tiempo']);
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
    public function reenviarCorreo(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['id'])) {
             http_response_code(400); echo json_encode(['error' => 'Falta ID']); return;
        }
        try {
            $datos = $this->calculosService->obtenerDatosEnvio((int)$input['id']);
            if ($datos) {
                $resend = new ResendService();
                $resend->enviarCotizacion($datos['uuid'], $datos['cliente_email'], $datos['cliente_nombre']);
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
}
?>