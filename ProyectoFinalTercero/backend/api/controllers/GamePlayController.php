<?php

require_once __DIR__ . '/../services/GamePlayService.php';
require_once __DIR__ . '/../services/RecoveryGameService.php';
require_once __DIR__ . '/../repositories/UserRepository.php';
require_once __DIR__ . '/../utils/JsonResponse.php';

class GamePlayController {
    private GamePlayService $gamePlayService;

    public function __construct() {
        $this->gamePlayService = new GamePlayService();
    }

    public function startGame($request) {
        try {
            if (!isset($request['player1_id']) || !isset($request['player2_id'])) {
                return JsonResponse::create(['error' => 'Missing player IDs'], 400);
            }
            
            $player1Id = intval($request['player1_id']);
            $player2Id = intval($request['player2_id']);
            
            if ($player1Id <= 0 || $player2Id <= 0) {
                return JsonResponse::create(['error' => 'Invalid player IDs'], 400);
            }

            try {
                $gameId = $this->gamePlayService->startGame($player1Id, $player2Id);
                return JsonResponse::create([
                    'success' => true,
                    'game_id' => $gameId
                ]);
            } catch (Exception $e) {
                error_log("Error starting game: " . $e->getMessage());
                return JsonResponse::create(['error' => $e->getMessage()], 500);
            }

        } catch (Exception $e) {
            error_log("Error in startGame: " . $e->getMessage());
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getPendingGames() {
        try {
            $userId = $_SESSION['user_id'] ?? null;
            if (!$userId) {
                return JsonResponse::create(['error' => 'Usuario no autenticado'], 401);
            }

            $games = $this->gamePlayService->getPendingGames($userId);
            
            return JsonResponse::create([
                'success' => true,
                'games' => $games
            ]);
        } catch (Exception $e) {
            error_log("Error in getPendingGames: " . $e->getMessage());
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function processTurn($request) {
        try {
            $requiredFields = ['game_id', 'player_seat', 'dino_id', 'enclosure_id'];
            foreach ($requiredFields as $field) {
                if (!isset($request[$field])) {
                    return JsonResponse::create([
                        'success' => false, 
                        'error' => "Missing $field",
                        'message' => "Falta el campo $field en la solicitud"
                    ], 400);
                }
            }
            
            $gameId = (int) $request['game_id'];
            $playerSeat = (int) $request['player_seat'];
            $dinoId = (int) $request['dino_id'];
            $enclosureId = (int) $request['enclosure_id'];
            $slotIndex = isset($request['slot_index']) ? (int) $request['slot_index'] : null;

            if ($enclosureId < 1 || $enclosureId > 7) {
                return JsonResponse::create([
                    'success' => false,
                    'error' => 'Invalid enclosure_id',
                    'message' => 'El enclosure_id debe estar en el rango 1..7',
                    'details' => [
                        'enclosure_id' => $enclosureId
                    ]
                ], 400);
            }
            
            try {
                $result = $this->gamePlayService->processTurn(
                    $gameId,
                    $playerSeat,
                    $dinoId,
                    $enclosureId,
                    $slotIndex
                );

                if ($result) {
                    return JsonResponse::create([
                        'success' => true,
                        'message' => "Turno procesado exitosamente",
                        'details' => [
                            'game_id' => $gameId,
                            'player_seat' => $playerSeat,
                            'dino_id' => $dinoId,
                            'enclosure_id' => $enclosureId,
                            'slot_index' => $slotIndex
                        ]
                    ]);
                } else {
                    $gameRepo = GameRepository::getInstance();
                    $game = $gameRepo->getGameById($gameId);
                    $activeSeat = $game ? ($game['active_seat'] ?? 0) : 0;
                    
                    $errorMessage = "No se pudo procesar el turno.";
                    if ($game && $activeSeat !== $playerSeat) {
                        $errorMessage = "No es tu turno. El turno actual es del jugador en el asiento $activeSeat.";
                    }
                    
                    return JsonResponse::create([
                        'success' => false,
                        'error' => $errorMessage,
                        'message' => $errorMessage,
                        'details' => [
                            'game_id' => $gameId,
                            'player_seat' => $playerSeat,
                            'active_seat' => $activeSeat,
                            'dino_id' => $dinoId, 
                            'enclosure_id' => $enclosureId,
                            'slot_index' => $slotIndex
                        ]
                    ], 400);
                }
            } catch (Exception $serviceException) {
                $errorMessage = $serviceException->getMessage();
                $statusCode = 500;
                if (stripos($errorMessage, "No es tu turno") !== false) {
                    $statusCode = 403;
                }
                
                error_log("Error in processTurn: " . $errorMessage);
                
                return JsonResponse::create([
                    'success' => false,
                    'error' => $errorMessage,
                    'message' => $errorMessage
                ], $statusCode);
            }

        } catch (Exception $e) {
            error_log("Error in processTurn: " . $e->getMessage());
            
            $errorMsg = $e->getMessage();
            if (strpos($errorMsg, "doesn't exist") !== false) {
                preg_match("/Table '(.*?)' doesn't exist/", $errorMsg, $matches);
                $tableName = isset($matches[1]) ? $matches[1] : "desconocida";
                
                return JsonResponse::create([
                    'success' => false, 
                    'error' => $errorMsg,
                    'message' => "Error del servidor: " . $errorMsg,
                    'debug_info' => [
                        'error_type' => 'missing_table',
                        'table_name' => $tableName
                    ]
                ], 500);
            }
            
            return JsonResponse::create([
                'success' => false, 
                'error' => $errorMsg,
                'message' => "Error del servidor: " . $errorMsg
            ], 500);
        }
    }

    public function rollDie($request) {
        try {
            $requiredFields = ['game_id', 'roller_seat', 'affected_seat', 'die_face'];
            foreach ($requiredFields as $field) {
                if (!isset($request[$field])) {
                    return JsonResponse::create(['error' => "Missing $field"], 400);
                }
            }

            $gameId = (int)$request['game_id'];
            $rollerSeat = (int)$request['roller_seat'];
            $affectedSeat = (int)$request['affected_seat'];
            $dieFace = $request['die_face'];
            
            $rollId = $this->gamePlayService->rollDie(
                $gameId,
                $rollerSeat,
                $affectedSeat,
                $dieFace
            );

            if ($rollId === null) {
                return JsonResponse::create([
                    'success' => false,
                    'error' => 'No es tu turno o el juego no existe',
                    'message' => 'Solo el jugador activo puede lanzar el dado'
                ], 403);
            }

            return JsonResponse::create([
                'success' => true,
                'roll_id' => $rollId
            ]);

        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getValidEnclosures($request) {
        try {
            if (!isset($request['game_id']) || !isset($request['player_seat'])) {
                return JsonResponse::create(['error' => 'Missing game_id or player_seat'], 400);
            }

            $enclosures = $this->gamePlayService->getValidEnclosuresForPlayer(
                $request['game_id'],
                $request['player_seat']
            );

            return JsonResponse::create([
                'success' => true,
                'enclosures' => $enclosures
            ]);

        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getAvailableOpponents($request) {
        try {
            if (!isset($request['user_id'])) {
                return JsonResponse::create(['error' => 'Missing user_id'], 400);
            }

            $userRepository = UserRepository::getInstance();
            $opponents = $userRepository->getAvailableOpponents($request['user_id']);

            return JsonResponse::create([
                'success' => true,
                'opponents' => $opponents
            ]);

        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getGameState($request) {
        try {
            if (!isset($request['game_id'])) {
                return JsonResponse::create(['error' => 'Missing game_id'], 400);
            }
            
            $gameId = intval($request['game_id']);
            $gameRepo = GameRepository::getInstance();
            $game = $gameRepo->getGameById($gameId);
            
            if (!$game) {
                return JsonResponse::create(['error' => 'Game not found'], 404);
            }

            $recoveryService = new RecoveryGameService();
            
            try {
                $isDevelopmentMode = true;
                
                try {
                    $gameState = $recoveryService->resumeGame($gameId);
                    
                    if (!$gameState) {
                        if ($isDevelopmentMode) {
                            $gameState = $this->createEmergencyGameState($gameId);
                        } else {
                            return JsonResponse::create(['error' => 'Unable to get game state'], 500);
                        }
                    }
                    
                    return JsonResponse::create([
                        'success' => true,
                        'game_state' => $gameState
                    ]);
                } catch (Exception $e) {
                    error_log("Error in resumeGame: " . $e->getMessage());
                    
                    if ($isDevelopmentMode) {
                        $gameState = $this->createEmergencyGameState($gameId);
                        
                        return JsonResponse::create([
                            'success' => true,
                            'game_state' => $gameState,
                            'debug_note' => 'Estado de emergencia creado debido a un error: ' . $e->getMessage()
                        ]);
                    } else {
                        return JsonResponse::create(['error' => 'Error retrieving game state: ' . $e->getMessage()], 500);
                    }
                }
            } catch (Exception $e) {
                error_log("Critical error in getGameState: " . $e->getMessage());
                return JsonResponse::create(['error' => 'Critical error in getGameState: ' . $e->getMessage()], 500);
            }

        } catch (Exception $e) {
            error_log("Error in getGameState: " . $e->getMessage());
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getPlayerBag($request) {
        try {
            if (!isset($request['game_id']) || !isset($request['player_seat'])) {
                return JsonResponse::create(['error' => 'Missing game_id or player_seat'], 400);
            }

            $gameId = (int)$request['game_id'];
            $playerSeat = (int)$request['player_seat'];
            if ($playerSeat < 0 || $playerSeat > 4) {
                return JsonResponse::create(['error' => 'Invalid player_seat (must be 0-4)'], 400);
            }

            $bag = $this->gamePlayService->getPlayerBagForUI($gameId, $playerSeat);
            return JsonResponse::create([
                'success' => true,
                'bag' => $bag
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getEnclosureContents($request) {
        try {
            $required = ['game_id', 'player_seat', 'enclosure_id'];
            foreach ($required as $f) {
                if (!isset($request[$f])) {
                    return JsonResponse::create(['error' => "Missing $f"], 400);
                }
            }

            $gameId = (int)$request['game_id'];
            $playerSeat = (int)$request['player_seat'];
            $enclosureId = (int)$request['enclosure_id'];

            if ($playerSeat < 0 || $playerSeat > 4) {
                return JsonResponse::create(['error' => 'Invalid player_seat (must be 0-4)'], 400);
            }
            if ($enclosureId < 1 || $enclosureId > 7) {
                return JsonResponse::create(['error' => 'Invalid enclosure_id (1..7)'], 400);
            }

            $dinos = $this->gamePlayService->getEnclosureContentsForUI($gameId, $playerSeat, $enclosureId);
            return JsonResponse::create([
                'success' => true,
                'enclosure_id' => $enclosureId,
                'player_seat' => $playerSeat,
                'dinos' => $dinos
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getScores($request) {
        try {
            if (!isset($request['game_id'])) {
                return JsonResponse::create(['error' => 'Missing game_id'], 400);
            }
            $gameId = (int)$request['game_id'];
            $scoresWithTrex = $this->gamePlayService->getScoresWithTrex($gameId);
            
            $formattedScores = [];
            $formattedTrexCounts = [];
            
            foreach ($scoresWithTrex as $seat => $data) {
                $formattedScores["player" . ($seat + 1)] = $data['score'];
                $formattedTrexCounts["player" . ($seat + 1)] = $data['trex_count'];
            }
            
            return JsonResponse::create([
                'success' => true,
                'scores' => $formattedScores,
                'trex_counts' => $formattedTrexCounts
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getGameHistory($request) {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $userId = $_SESSION['user_id'] ?? null;
            if (!$userId) {
                return JsonResponse::create(['error' => 'Usuario no autenticado'], 401);
            }

            $gameRepo = GameRepository::getInstance();
            $games = $gameRepo->getGameHistory($userId);
            
            return JsonResponse::create([
                'success' => true,
                'games' => $games
            ]);
        } catch (Exception $e) {
            error_log("Error in getGameHistory: " . $e->getMessage());
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }
    
    private function createEmergencyGameState(int $gameId): array 
    {
        $gameRepo = GameRepository::getInstance();
        $game = $gameRepo->getGameById($gameId);
        
        if (!$game) {
            $game = [
                'game_id' => $gameId,
                'player1_user_id' => 1,
                'player2_user_id' => 2,
                'player1_name' => 'Player 1',
                'player2_name' => 'Player 2',
                'status' => 'IN_PROGRESS',
                'round' => 1,
                'turn' => 1,
                'active_player' => 0,
                'active_bag' => 0,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ];
        }
        
        $enclosureDefinitions = [
            ['id' => 1, 'type' => 'same_type', 'max_slots' => 8],
            ['id' => 2, 'type' => 'different_type', 'max_slots' => 6],
            ['id' => 3, 'type' => 'pairs', 'max_slots' => 6],
            ['id' => 4, 'type' => 'trio', 'max_slots' => 3],
            ['id' => 5, 'type' => 'king', 'max_slots' => 1],
            ['id' => 6, 'type' => 'solo', 'max_slots' => 1],
            ['id' => 7, 'type' => 'river', 'max_slots' => 4],
        ];
        
        $enclosures1 = [];
        foreach ($enclosureDefinitions as $enclosure) {
            $enclosures1[] = [
                'enclosure_id' => $enclosure['id'],
                'enclosure_type' => $enclosure['type'],
                'max_slots' => $enclosure['max_slots'],
                'placements' => []
            ];
        }
        
        $enclosures2 = [];
        foreach ($enclosureDefinitions as $enclosure) {
            $enclosures2[] = [
                'enclosure_id' => $enclosure['id'] + 7,
                'enclosure_type' => $enclosure['type'],
                'max_slots' => $enclosure['max_slots'],
                'placements' => []
            ];
        }
        
        $defaultBag = [
            ['dino_id' => 101, 'species_id' => 1, 'name' => 'T-Rex', 'img' => 'trex.png', 'dino_color' => 'red'],
            ['dino_id' => 102, 'species_id' => 2, 'name' => 'Stegosaurus', 'img' => 'stego.png', 'dino_color' => 'green'],
            ['dino_id' => 103, 'species_id' => 3, 'name' => 'Triceratops', 'img' => 'trice.png', 'dino_color' => 'blue'],
            ['dino_id' => 104, 'species_id' => 4, 'name' => 'Brachiosaurus', 'img' => 'brachio.png', 'dino_color' => 'yellow']
        ];
        
        return [
            'game' => $game,
            'players' => [
                0 => [
                    'user_id' => $game['player1_user_id'],
                    'username' => isset($game['player1_name']) ? $game['player1_name'] : 'Player 1',
                    'bag' => ['dinos' => $defaultBag],
                    'board' => ['enclosures' => $enclosures1],
                    'score' => 0
                ],
                1 => [
                    'user_id' => $game['player2_user_id'],
                    'username' => isset($game['player2_name']) ? $game['player2_name'] : 'Player 2',
                    'bag' => ['dinos' => $defaultBag],
                    'board' => ['enclosures' => $enclosures2],
                    'score' => 0
                ]
            ],
            'last_die_roll' => [
                'die_roll_id' => 1,
                'game_id' => $gameId,
                'player_seat' => 0,
                'roll_value' => 1,
                'created_at' => date('Y-m-d H:i:s')
            ],
            'is_emergency_state' => true,
            'debug_note' => 'Este es un estado de emergencia creado para desarrollo'
        ];
    }
}