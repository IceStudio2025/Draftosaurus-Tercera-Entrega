<?php

require_once __DIR__ . '/../controllers/RoomController.php';

class RoomRoutes {
    public static function register($router) {
        $roomController = new RoomController();
        $router->post('/api/room/create', [$roomController, 'createRoom']);
        $router->get('/api/room/{room_code}', [$roomController, 'getRoomInfo']);
        $router->post('/api/room/{room_code}/start', [$roomController, 'startGame']);
        $router->post('/api/room/{room_code}/join', [$roomController, 'joinRoom']);
        $router->post('/api/room/{room_code}/add-test-players', [$roomController, 'addTestPlayers']);
    }
}
