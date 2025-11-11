<?php

require_once __DIR__ . '/utils/Router.php';
require_once __DIR__ . '/routers/routes.php';

header('Content-Type: application/json');

// Permitir CORS desde cualquier origen (útil para desarrollo LAN)
// En producción, deberías restringir esto a dominios específicos
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Lista de orígenes permitidos (localhost y rangos de IP privadas comunes)
$allowedOrigins = array(
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:8000',
    'http://localhost:8000'
);

// Si el origen está en la lista permitida, usarlo
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    // Permitir desde cualquier IP privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    // Esto permite conexiones LAN
    if (preg_match('/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/', $origin)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
    } else {
        // Fallback a localhost para desarrollo local
        header('Access-Control-Allow-Origin: http://127.0.0.1:5500');
        header('Access-Control-Allow-Credentials: true');
    }
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function errorHandler($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error interno del servidor',
        'message' => $errstr,
        'file' => $errfile,
        'line' => $errline
    ]);
    exit();
}
set_error_handler('errorHandler');

try {
    $router = new Router();
    Routes::defineRoutes($router);
    $router->run();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error interno del servidor',
        'message' => $e->getMessage(),
    ]);
}
