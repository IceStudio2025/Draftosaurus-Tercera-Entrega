<?php

require_once __DIR__ . '/../controllers/RecoveryGameController.php';

class RecoveryRoutes {
    public static function register($router) {
        $recoveryController = new RecoveryGameController();
        $router->get('/api/recovery/{game_id}', [$recoveryController, 'getGameHistory']);
        $router->get('/api/game/resume/{game_id}', [$recoveryController, 'resumeGame']);
        $router->get('/api/game/pending/{user_id}', [$recoveryController, 'getInProgressGames']);
        $router->get('/api/game/history/{user_id}', [$recoveryController, 'getCompletedGamesHistory']);
    }
}
