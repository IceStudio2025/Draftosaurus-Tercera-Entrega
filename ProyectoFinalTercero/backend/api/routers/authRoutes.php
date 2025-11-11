<?php

require_once __DIR__ . '/../controllers/AuthController.php';

class AuthRoutes {
    public static function register($router) {
        $authController = new AuthController();
        $router->post('/api/auth/register', [$authController, 'register']);
        $router->post('/api/auth/login', [$authController, 'login']);
        $router->post('/api/auth/logout', [$authController, 'logout']);
        $router->post('/api/auth/guest', [$authController, 'createGuest']);
    }
}
