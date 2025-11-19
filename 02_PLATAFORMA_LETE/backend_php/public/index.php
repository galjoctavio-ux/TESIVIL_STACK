<?php
// Cargar todas las librerías (Composer)
require_once __DIR__ . '/../vendor/autoload.php';

// Cargar bootstrap para variables de entorno
require_once __DIR__ . '/../config/bootstrap.php';

// Cargar manualmente la librería JWT y el Middleware
require_once __DIR__ . '/../src/Firebase/JWT/JWT.php';
require_once __DIR__ . '/../src/Firebase/JWT/Key.php';
require_once __DIR__ . '/../src/Middleware/AuthMiddleware.php';

// 1. CONFIGURACIÓN DE CORS Y HEADERS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. CARGAR TODOS LOS CONTROLADORES
require_once __DIR__ . '/../src/Controllers/CotizacionController.php';
require_once __DIR__ . '/../src/Controllers/PdfController.php';
require_once __DIR__ . '/../src/Controllers/RevisionPdfController.php';
require_once __DIR__ . '/../src/Controllers/XmlController.php';
require_once __DIR__ . '/../src/Controllers/AiController.php';
require_once __DIR__ . '/../src/Controllers/ConfigController.php';

// 3. CARGAR DEFINICIÓN DE RUTAS
$routes = require_once __DIR__ . '/../config/routes.php';

// 4. LÓGICA DEL ENRUTADOR
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

$routeFound = false;

foreach ($routes as $route) {
    $pattern = $route['uri'];
    // Comprobar si la ruta es una expresión regular
    $isRegex = substr($pattern, 0, 1) === '/' && substr($pattern, -1) === '/';

    if ($method !== $route['method']) {
        continue;
    }

    $uriMatches = false;
    $matches = [];

    if ($isRegex) {
        if (preg_match($pattern, $uri, $matches)) {
            // Eliminar el match completo para pasar solo los parámetros
            array_shift($matches);
            $uriMatches = true;
        }
    } else {
        // Manejo de rutas estáticas, incluyendo aquellas con query string
        $uriWithoutQuery = strtok($uri, '?');
        if ($uriWithoutQuery === $pattern) {
            $uriMatches = true;
        }
    }

    if ($uriMatches) {
        // >>> APLICAR MIDDLEWARE A RUTAS PROTEGIDAS <<<
        if (strpos($uri, '/api/admin/') === 0) {
            App\Middleware\AuthMiddleware::handle();
        }

        $controllerName = $route['controller'];
        $action = $route['action'];

        // Establecer header aquí para evitar duplicación
        if ($action !== 'exportarMaterialesTxt' && $action !== 'generarPdfFromUuid') {
            header("Content-Type: application/json; charset=UTF-8");
        }

        $controller = new $controllerName();
        // Llamar al método con los parámetros capturados (si los hay)
        call_user_func_array([$controller, $action], $matches);

        $routeFound = true;
        break;
    }
}

if (!$routeFound) {
    http_response_code(404);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['error' => 'Ruta no encontrada o método incorrecto: ' . $uri]);
}
