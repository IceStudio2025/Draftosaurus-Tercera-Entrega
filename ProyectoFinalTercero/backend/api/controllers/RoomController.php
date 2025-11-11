<?php
require_once __DIR__ . '/../repositories/RoomRepository.php';
require_once __DIR__ . '/../services/GamePlayService.php';
require_once __DIR__ . '/../utils/JsonResponse.php';

class RoomController {
    private RoomRepository $roomRepo;
    private GamePlayService $gameService;

    public function __construct() {
        $this->roomRepo = RoomRepository::getInstance();
        $this->gameService = new GamePlayService();
    }

    public function createRoom($request) {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $userId = $_SESSION['user_id'] ?? $request['user_id'] ?? null;
            if (!$userId) {
                return JsonResponse::create(['error' => 'User not authenticated'], 401);
            }

            $isGuest = isset($_SESSION['is_guest']) && $_SESSION['is_guest'] === true;
            if ($isGuest) {
                return JsonResponse::create(['error' => 'Los invitados solo pueden unirse a salas con código'], 403);
            }

            $roomCode = strtoupper($request['room_code'] ?? '');
            $maxPlayers = (int)($request['max_players'] ?? 2);
            $direction = $request['game_direction'] ?? 'clockwise';
            $boardType = $request['board_type'] ?? 'primavera';

            if (!in_array($boardType, ['primavera', 'verano'])) {
                $boardType = 'primavera';
            }

            if (empty($roomCode) || $maxPlayers < 2 || $maxPlayers > 5) {
                return JsonResponse::create(['error' => 'Invalid parameters'], 400);
            }

            $roomId = $this->roomRepo->createRoom($roomCode, $userId, $maxPlayers, $direction, $boardType);
            
            if (!$roomId) {
                return JsonResponse::create(['error' => 'Room code already exists'], 409);
            }

            $this->roomRepo->addPlayerToRoom($roomId, $userId, 0);

            return JsonResponse::create([
                'success' => true,
                'room_id' => $roomId,
                'room_code' => $roomCode
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function getRoomInfo($request) {
        try {
            $code = $request['room_code'] ?? '';
            
            if (empty($code)) {
                return JsonResponse::create(['error' => 'Room code is required'], 400);
            }
            
            $room = $this->roomRepo->getRoomByCode($code);
            
            if (!$room) {
                return JsonResponse::create(['error' => 'Room not found'], 404);
            }

            $players = $this->roomRepo->getRoomPlayers($room['room_id']);

            return JsonResponse::create([
                'success' => true,
                'room' => $room,
                'players' => $players
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function startGame($request) {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $code = $request['room_code'] ?? '';
            
            if (empty($code)) {
                return JsonResponse::create(['error' => 'Room code is required'], 400);
            }
            
            $userId = $_SESSION['user_id'] ?? $request['user_id'] ?? null;

            if (!$userId) {
                return JsonResponse::create(['error' => 'User not authenticated'], 401);
            }

            $room = $this->roomRepo->getRoomByCode($code);
            if (!$room) {
                return JsonResponse::create(['error' => 'Room not found'], 404);
            }

            if ($room['admin_user_id'] != $userId) {
                return JsonResponse::create(['error' => 'Only admin can start game'], 403);
            }

            $players = $this->roomRepo->getRoomPlayers($room['room_id']);
            if (count($players) < 2) {
                return JsonResponse::create(['error' => 'Need at least 2 players'], 400);
            }

            $playerIds = array_column($players, 'user_id');
            
            try {
                $gameId = $this->roomRepo->startGameFromRoom($room['room_id'], $playerIds);
            } catch (Exception $e) {
                return JsonResponse::create(['error' => 'Error al iniciar partida: ' . $e->getMessage()], 500);
            }

            if (!$gameId) {
                return JsonResponse::create(['error' => 'Failed to create game'], 500);
            }

            return JsonResponse::create([
                'success' => true,
                'game_id' => $gameId
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function joinRoom($request) {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $code = $request['room_code'] ?? '';
            
            if (empty($code)) {
                return JsonResponse::create(['error' => 'Room code is required'], 400);
            }
            
            $userId = $_SESSION['user_id'] ?? $request['user_id'] ?? null;

            if (!$userId) {
                return JsonResponse::create(['error' => 'User not authenticated'], 401);
            }

            $room = $this->roomRepo->getRoomByCode($code);
            if (!$room) {
                return JsonResponse::create(['error' => 'Room not found'], 404);
            }

            $players = $this->roomRepo->getRoomPlayers($room['room_id']);
            if (count($players) >= $room['max_players']) {
                return JsonResponse::create(['error' => 'Room is full'], 400);
            }

            foreach ($players as $player) {
                if ($player['user_id'] == $userId) {
                    return JsonResponse::create(['error' => 'Already in room'], 400);
                }
            }

            $nextSeat = count($players);
            $success = $this->roomRepo->addPlayerToRoom($room['room_id'], $userId, $nextSeat);

            if (!$success) {
                return JsonResponse::create(['error' => 'Failed to join room'], 500);
            }

            return JsonResponse::create([
                'success' => true,
                'message' => 'Joined room successfully',
                'room_id' => $room['room_id']
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }

    public function addTestPlayers($request) {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $code = $request['room_code'] ?? '';
            
            if (empty($code)) {
                return JsonResponse::create(['error' => 'Room code is required'], 400);
            }
            
            $userId = $_SESSION['user_id'] ?? $request['user_id'] ?? null;

            if (!$userId) {
                return JsonResponse::create(['error' => 'User not authenticated'], 401);
            }

            $room = $this->roomRepo->getRoomByCode($code);
            if (!$room) {
                return JsonResponse::create(['error' => 'Room not found'], 404);
            }

            if ($room['admin_user_id'] != $userId) {
                return JsonResponse::create(['error' => 'Only admin can add test players'], 403);
            }

            $allUsers = $this->roomRepo->getAllUsers();
            $currentPlayers = $this->roomRepo->getRoomPlayers($room['room_id']);
            $currentPlayerIds = array_column($currentPlayers, 'user_id');
            
            $availableUsers = array_filter($allUsers, function($user) use ($currentPlayerIds) {
                return !in_array($user['user_id'], $currentPlayerIds);
            });

            $needed = $room['max_players'] - count($currentPlayers);
            $added = 0;

            foreach (array_slice($availableUsers, 0, $needed) as $user) {
                $nextSeat = count($currentPlayers) + $added;
                if ($this->roomRepo->addPlayerToRoom($room['room_id'], $user['user_id'], $nextSeat)) {
                    $added++;
                }
            }

            return JsonResponse::create([
                'success' => true,
                'added' => $added,
                'message' => "Added $added test players"
            ]);
        } catch (Exception $e) {
            return JsonResponse::create(['error' => $e->getMessage()], 500);
        }
    }
}