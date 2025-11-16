<?php
// Cargar todas las librerías (Composer)
require_once __DIR__ . '/../vendor/autoload.php';

// 1. CONFIGURACIÓN DE CORS Y HEADERS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. CARGAR TODOS LOS CONTROLADORES
require_once __DIR__ . '/../src/Controllers/CotizacionController.php';
require_once __DIR__ . '/../src/Controllers/PdfController.php'; 
require_once __DIR__ . '/../src/Controllers/XmlController.php';
require_once __DIR__ . '/../src/Controllers/AiController.php';
require_once __DIR__ . '/../src/Controllers/ConfigController.php'; // <--- ¡ESTA LÍNEA ES VITAL!

// 3. RUTEO (ROUTER)
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// --- BLOQUE A: COTIZADOR BÁSICO ---

// RUTA A: Calcular (POST)
if ($uri === '/api/cotizar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->crearCotizacion();
} 
// RUTA B: Guardar y Enviar (POST)
elseif ($uri === '/api/cotizar/guardar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->guardarCotizacion();
} 
// RUTA C: Generar PDF (GET)
elseif (strpos($uri, '/api/cotizar/pdf') === 0 && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['uuid'])) {
        $controller = new PdfController();
        $controller->generarPdf($_GET['uuid']);
    } else {
        http_response_code(400); echo "Error: Falta el UUID";
    }
} 

// --- BLOQUE B: RECURSOS E INVENTARIO ---

// RUTA D: Recursos (GET = Listar, POST = Crear)
elseif ($uri === '/api/recursos') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $controller->listarRecursos();
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $controller->nuevoRecurso();
    }
}
// RUTA E: Subir XML (POST)
elseif ($uri === '/api/xml/upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new XmlController();
    $controller->subirXml();
}
// RUTA F: Listar Pendientes de Mapeo (GET)
elseif ($uri === '/api/admin/pendientes' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new XmlController();
    $controller->listarPendientes();
}
// RUTA G: Vincular Pendiente (POST)
elseif ($uri === '/api/admin/vincular' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new XmlController();
    $controller->vincular();
}
// RUTA H: Editar Recurso (POST)
elseif ($uri === '/api/recursos/editar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->editarRecurso();
}
// RUTA I: Eliminar Recurso (POST)
elseif ($uri === '/api/recursos/eliminar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->eliminarRecurso();
}
// RUTA J: Inventario Admin (GET)
elseif ($uri === '/api/admin/inventario' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->listarInventarioAdmin();
}
// RUTA K: Aprobar Recurso (POST)
elseif ($uri === '/api/recursos/aprobar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->aprobarRecurso();
}

// --- BLOQUE C: INTELIGENCIA ARTIFICIAL ---

// RUTA L: Asistente IA Sugerencias (POST)
elseif ($uri === '/api/ia/sugerir' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new AiController();
    $controller->sugerirMateriales();
}
// RUTA U: Auditoría Inventario (GET)
elseif ($uri === '/api/admin/auditoria-inventario' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new AiController();
    $controller->auditarInventario();
}

// --- BLOQUE D: ADMINISTRACIÓN DE COTIZACIONES ---

// RUTA NUEVA: Autorizar Cotización (RESTful)
elseif (preg_match('/^\/api\/cotizaciones\/authorize\/(\d+)$/', $uri, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->authorize((int)$matches[1]);
}
// RUTA M: Listar Cotizaciones (Admin)
elseif ($uri === '/api/admin/cotizaciones' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->listarCotizacionesAdmin();
}
// RUTA N: Exportar Materiales TXT (GET)
elseif ($uri === '/api/cotizacion/exportar' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Content-Type: text/plain; charset=utf-8');
    if (isset($_GET['id'])) {
        $controller = new CotizacionController();
        $controller->exportarMaterialesTxt();
    } else {
        http_response_code(400); echo "Error: Falta el ID";
    }
}
// RUTA O: Aplicar Descuento (POST)
elseif ($uri === '/api/cotizacion/aplicar-descuento' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->aplicarDescuento();
}
// RUTA P: Autorizar (POST)
elseif ($uri === '/api/admin/cotizacion/autorizar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->autorizarCotizacion();
}
// RUTA Q: Rechazar (POST)
elseif ($uri === '/api/admin/cotizacion/rechazar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->rechazarCotizacion();
}
// RUTA R: Finalizar Proyecto (POST)
elseif ($uri === '/api/admin/cotizacion/finalizar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->finalizarProyecto();
}
// RUTA S: Clonar Cotización (POST)
elseif ($uri === '/api/admin/cotizacion/clonar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->clonarCotizacion();
}
// RUTA T: Reenviar Correo (POST)
elseif ($uri === '/api/admin/cotizacion/reenviar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->reenviarCorreo();
}

// --- BLOQUE E: CONFIGURACIÓN FINANCIERA (¡ESTO FALTABA PROBABLEMENTE!) ---

// RUTA V: Listar Configuración (GET)
elseif ($uri === '/api/admin/configuracion' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new ConfigController();
    $controller->listarConfiguracion();
}
// RUTA W: Actualizar Configuración (POST)
elseif ($uri === '/api/admin/configuracion/actualizar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new ConfigController();
    $controller->actualizarConfiguracion();
}
// RUTA X: Obtener Detalle Edición (GET)
elseif ($uri === '/api/admin/cotizacion/detalle' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->obtenerDetalleEdicion();
}
// RUTA Y: Guardar Edición Admin (POST) - Usaremos 'actualizarCotizacion' que ya creamos en el paso 10.1
// Solo necesitamos asegurarnos que esa ruta apunte a 'actualizarCotizacion'
elseif ($uri === '/api/admin/cotizacion/guardar-cambios' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=UTF-8");
    $controller = new CotizacionController();
    $controller->actualizarCotizacion();
}

// RUTA NO ENCONTRADA
else {
    http_response_code(404);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['error' => 'Ruta no encontrada o método incorrecto: ' . $uri]);
}
?>