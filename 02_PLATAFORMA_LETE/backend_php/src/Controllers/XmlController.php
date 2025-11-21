<?php
declare(strict_types=1);

require_once __DIR__ . '/../Services/XmlService.php';

class XmlController {
    private XmlService $xmlService;

    public function __construct() {
        $this->xmlService = new XmlService();
    }

    // 1. SUBIR XML (MODIFICADO PARA MULTI-ARCHIVOS)
    public function subirXml(): void {
        // Validar que existe la entrada 'xml'
        if (!isset($_FILES['xml'])) {
            http_response_code(400);
            echo json_encode(['error' => 'No se enviaron archivos.']);
            return;
        }

        $xmlContents = [];
        $files = $_FILES['xml'];

        // Detectar si se envió uno solo o múltiples
        // En PHP, si envías multiple, 'name' es un array. Si es uno solo, es string.
        $isMultiple = is_array($files['name']);
        $count = $isMultiple ? count($files['name']) : 1;

        for ($i = 0; $i < $count; $i++) {
            $name = $isMultiple ? $files['name'][$i] : $files['name'];
            $tmpName = $isMultiple ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error = $isMultiple ? $files['error'][$i] : $files['error'];

            // 1. Validar errores de subida
            if ($error !== UPLOAD_ERR_OK) continue; 

            // 2. Validar extensión
            $ext = pathinfo($name, PATHINFO_EXTENSION);
            if (strtolower($ext) !== 'xml') continue;

            // 3. Leer contenido y agregar a la lista
            $contenido = file_get_contents($tmpName);
            if ($contenido) {
                $xmlContents[] = $contenido;
            }
        }

        if (empty($xmlContents)) {
            http_response_code(400);
            echo json_encode(['error' => 'No se encontraron archivos XML válidos para procesar.']);
            return;
        }

        try {
            // LLAMADA A LA NUEVA FUNCIÓN DEL SERVICIO (LOTE)
            // Asegúrate de que XmlService ya tenga el método procesarListaXml
            $resumen = $this->xmlService->procesarListaXml($xmlContents);

            // Transformar respuesta para el Frontend
            $respuesta = [
                'status' => 'success',
                'nuevos' => $resumen['nuevos_auto_creados'] ?? 0,
                'actualizados' => $resumen['precios_actualizados'] ?? 0,
                'total_procesados' => $resumen['archivos_procesados'] ?? 0,
                // Enviamos 'data' completo por si quieres mostrar detalles de errores en el futuro
                'data' => $resumen 
            ];

            header('Content-Type: application/json');
            echo json_encode($respuesta);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error interno: ' . $e->getMessage()]);
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