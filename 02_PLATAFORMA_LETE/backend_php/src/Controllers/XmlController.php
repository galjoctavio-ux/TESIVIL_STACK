<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/XmlService.php';

class XmlController {
    private XmlService $xmlService;

    public function __construct() {
        $this->xmlService = new XmlService();
    }

    // 1. SUBIR XML (Ya existente)
    public function subirXml(): void {
        if (!isset($_FILES['xml']) || $_FILES['xml']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No se envió ningún archivo o hubo un error.']);
            return;
        }

        $ext = pathinfo($_FILES['xml']['name'], PATHINFO_EXTENSION);
        if (strtolower($ext) !== 'xml') {
            http_response_code(400);
            echo json_encode(['error' => 'El archivo debe ser .xml']);
            return;
        }

        try {
            $contenido = file_get_contents($_FILES['xml']['tmp_name']);
            $resumen = $this->xmlService->procesarXml($contenido);

            // Transformar el resumen al formato deseado
            $respuesta = [
                'nuevos' => $resumen['nuevos_auto_creados'] ?? 0,
                'actualizados' => $resumen['precios_actualizados'] ?? 0,
            ];

            header('Content-Type: application/json');
            echo json_encode($respuesta);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // 2. LISTAR PENDIENTES (Nuevo)
    public function listarPendientes(): void {
        try {
            $pendientes = $this->xmlService->obtenerPendientes();
            header('Content-Type: application/json');
            echo json_encode(['status' => 'success', 'data' => $pendientes]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // 3. VINCULAR PRODUCTO (Nuevo)
    public function vincular(): void {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id_mapeo']) || !isset($input['id_recurso'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Faltan datos (id_mapeo, id_recurso)']);
            return;
        }

        try {
            $this->xmlService->vincularRecurso(
                intval($input['id_mapeo']),
                intval($input['id_recurso'])
            );

            echo json_encode(['status' => 'success', 'message' => 'Vinculado correctamente']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
?>