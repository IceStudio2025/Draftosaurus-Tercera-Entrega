<?php

require_once __DIR__ . '/authRoutes.php';
require_once __DIR__ . '/gameRoutes.php';
require_once __DIR__ . '/userRoutes.php';
require_once __DIR__ . '/recoveryRoutes.php';
require_once __DIR__ . '/roomRoutes.php';
require_once __DIR__ . '/chatbotRoutes.php';

class Routes {
    public static function defineRoutes($router) {
        // Health check endpoint para verificar conectividad
        $router->get('/api/health', function() {
            http_response_code(200);
            echo json_encode([
                'status' => 'ok',
                'message' => 'Servidor funcionando correctamente',
                'timestamp' => date('Y-m-d H:i:s')
            ]);
        });
        
        AuthRoutes::register($router);
        GameRoutes::register($router);
        RecoveryRoutes::register($router);
        UserRoutes::register($router);
        RoomRoutes::register($router);
        ChatbotRoutes::register($router);
        
        return $router;
    }
}