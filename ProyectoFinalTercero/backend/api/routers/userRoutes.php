<?php

require_once __DIR__ . '/../controllers/UserController.php';

class UserRoutes {
    public static function register($router) {
        $userController = new UserController();
        $router->get('/api/user/current', [$userController, 'getCurrentUser']);
        $router->get('/api/user/opponents/{user_id}', [$userController, 'getAvailableOpponents']);
        $router->get('/api/user/{user_id}', [$userController, 'getUserInfo']);
    }
}
