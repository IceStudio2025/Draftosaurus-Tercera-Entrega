<?php

require_once __DIR__ . '/../services/RecoveryGameService.php';
require_once __DIR__ . '/../utils/JsonResponse.php';

class RecoveryGameController {
    private RecoveryGameService $recoveryService;

    public function __construct() {
        $this->recoveryService = new RecoveryGameService();
    }

    public function getInProgressGames($request) {
        try {
            if (!isset($request['user_id'])) {
                return JsonResponse::create(['error' => 'Missing user_id'], 400);
            }

            $games = $this->recoveryService->getInProgressGames($request['user_id']);
            
            return JsonResponse::create([
                'success' => true,
                'games' => $games
            ]);

        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function resumeGame($request) {
        try {
            if (!isset($request['game_id'])) {
                return JsonResponse::create(['error' => 'Missing game_id'], 400);
            }

            $userId = null;
            if (isset($request['user_id'])) {
                $userId = intval($request['user_id']);
            } elseif (isset($_GET['user_id'])) {
                $userId = intval($_GET['user_id']);
            }

            $gameState = $this->recoveryService->resumeGame($request['game_id'], $userId);
            
            if (!$gameState) {
                return JsonResponse::create(['error' => 'Game not found or not in progress'], 404);
            }

            return JsonResponse::create([
                'success' => true,
                'game_state' => $gameState
            ]);

        } catch (Exception $e) {
            error_log("Error in resumeGame: " . $e->getMessage());
            return JsonResponse::create([
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getGameHistory($request) {
        return $this->resumeGame($request);
    }

    public function getCompletedGamesHistory($request) {
        try {
            if (!isset($request['user_id'])) {
                return JsonResponse::create(['error' => 'Missing user_id'], 400);
            }
            
            $userId = (int)$request['user_id'];
            $games = $this->recoveryService->getGameHistory($userId);
            
            return JsonResponse::create([
                'success' => true,
                'games' => $games
            ]);
        } catch (Exception $e) {
            error_log("Error in getCompletedGamesHistory: " . $e->getMessage());
            return JsonResponse::create(['error' => 'Internal server error'], 500);
        }
    }
}