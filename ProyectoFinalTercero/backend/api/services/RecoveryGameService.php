<?php

require_once __DIR__ . '/../repositories/GameRepository.php';
require_once __DIR__ . '/../repositories/BagRepository.php';
require_once __DIR__ . '/../repositories/PlacementDieRollRepository.php';
require_once __DIR__ . '/../repositories/PlacementRepository.php';
require_once __DIR__ . '/../repositories/FinalScoreRepository.php';
require_once __DIR__ . '/../repositories/RoomRepository.php';
require_once __DIR__ . '/../config/Database.php';

class RecoveryGameService 
{
    private GameRepository $gameRepo;
    private BagRepository $bagRepo;
    private PlacementDieRollRepository $dieRepo;
    private PlacementRepository $placementRepo;
    private FinalScoreRepository $scoreRepo;
    private mysqli $conn;

    public function __construct() 
    {
        $this->gameRepo = GameRepository::getInstance();
        $this->bagRepo = BagRepository::getInstance();
        $this->dieRepo = PlacementDieRollRepository::getInstance();
        $this->placementRepo = PlacementRepository::getInstance();
        $this->scoreRepo = FinalScoreRepository::getInstance();
        
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function resumeGame(int $gameId, ?int $userId = null): ?array 
    {
        $game = $this->gameRepo->getGameById($gameId);
        if (!$game) {
            return null;
        }
        
        if ($game['status'] !== 'IN_PROGRESS' && $game['status'] !== 'CREATED') {
            return null;
        }
        
        try {
            $player1_name = isset($game['player1_name']) ? $game['player1_name'] : 'Jugador 1';
            $player2_name = isset($game['player2_name']) ? $game['player2_name'] : 'Jugador 2';
            $player3_name = isset($game['player3_name']) ? $game['player3_name'] : 'Jugador 3';
            $player4_name = isset($game['player4_name']) ? $game['player4_name'] : 'Jugador 4';
            $player5_name = isset($game['player5_name']) ? $game['player5_name'] : 'Jugador 5';
            
            $player1Bag = $this->getBagState($gameId, 0);
            $player2Bag = $this->getBagState($gameId, 1);
            
            $player1Placements = $this->getPlayerPlacements($gameId, 0);
            $player2Placements = $this->getPlayerPlacements($gameId, 1);
            
            $enclosures1 = [];
            $enclosures2 = [];
            
            $enclosureDefinitions = [
                ['id' => 1, 'type' => 'same_type', 'max_slots' => 6],
                ['id' => 2, 'type' => 'different_type', 'max_slots' => 6],
                ['id' => 3, 'type' => 'pairs', 'max_slots' => 6],
                ['id' => 4, 'type' => 'trio', 'max_slots' => 3],
                ['id' => 5, 'type' => 'king', 'max_slots' => 1],
                ['id' => 6, 'type' => 'solo', 'max_slots' => 1],
                ['id' => 7, 'type' => 'river', 'max_slots' => 6],
            ];
            
            foreach ($enclosureDefinitions as $enclosure) {
                $enclosures1[] = [
                    'enclosure_id' => $enclosure['id'],
                    'enclosure_type' => $enclosure['type'],
                    'max_slots' => $enclosure['max_slots'],
                    'placements' => []
                ];
            }
            
            foreach ($enclosureDefinitions as $enclosure) {
                $enclosures2[] = [
                    'enclosure_id' => $enclosure['id'] + 7,
                    'enclosure_type' => $enclosure['type'],
                    'max_slots' => $enclosure['max_slots'],
                    'placements' => []
                ];
            }

            $lastRoll = $this->dieRepo->getLastGameRoll($gameId);
            
            $roomRepo = RoomRepository::getInstance();
            $room = $roomRepo->getRoomByGameId($gameId);
            $boardType = $room && isset($room['board_type']) ? $room['board_type'] : 'primavera';
            
            $playerSeat = 0;
            if ($userId && (int)$game['player2_user_id'] === (int)$userId) {
                $playerSeat = 1;
            }
            
            $player1BagFormatted = [];
            foreach ($player1Bag as $dino) {
                $dinoColor = $dino['dino_color'] ?? $dino['color'] ?? 'unknown';
                $dinosaurType = $this->mapColorToType($dinoColor);
                
                $player1BagFormatted[] = [
                    'id' => $dino['dino_id'] ?? $dino['bag_content_id'] ?? 0,
                    'dinosaur_type' => $dinosaurType,
                    'orientation' => 'horizontal'
                ];
            }
            
            $player2BagFormatted = [];
            foreach ($player2Bag as $dino) {
                $dinoColor = $dino['dino_color'] ?? $dino['color'] ?? 'unknown';
                $dinosaurType = $this->mapColorToType($dinoColor);
                
                $player2BagFormatted[] = [
                    'id' => $dino['dino_id'] ?? $dino['bag_content_id'] ?? 0,
                    'dinosaur_type' => $dinosaurType,
                    'orientation' => 'horizontal'
                ];
            }
            
            $player1EnclosuresFormatted = $this->formatPlacementsForUI($player1Placements);
            $player2EnclosuresFormatted = $this->formatPlacementsForUI($player2Placements);
            
            return [
                'game_id' => $game['game_id'],
                'status' => $game['status'],
                'current_round' => $game['current_round'] ?? 1,
                'current_turn' => $game['current_turn'] ?? 1,
                'active_seat' => $game['active_seat'] ?? 0,
                'playerSeat' => $playerSeat,
                'player1_user_id' => $game['player1_user_id'],
                'player2_user_id' => $game['player2_user_id'],
                'player3_user_id' => $game['player3_user_id'] ?? null,
                'player4_user_id' => $game['player4_user_id'] ?? null,
                'player5_user_id' => $game['player5_user_id'] ?? null,
                'player1_username' => $player1_name,
                'player2_username' => $player2_name,
                'player3_username' => $player3_name,
                'player4_username' => $player4_name,
                'player5_username' => $player5_name,
                'player1_bag' => $player1BagFormatted,
                'player2_bag' => $player2BagFormatted,
                'player1_enclosures' => $player1EnclosuresFormatted,
                'player2_enclosures' => $player2EnclosuresFormatted,
                'player1_score' => 0,
                'player2_score' => 0,
                'last_die_roll' => $lastRoll,
                'board_type' => $boardType,
            ];
        } catch (Exception $e) {
            error_log("Error in resumeGame: " . $e->getMessage());
            throw $e;
        }
    }

    private function getBagState(int $gameId, int $playerSeat): array 
    {
        try {
            $bagContents = $this->bagRepo->getDinosInBag($gameId, $playerSeat);
            
            if (empty($bagContents)) {
                return [
                    ['dino_id' => 101, 'species_id' => 1, 'name' => 'Triceratops', 'img' => './img/amarilloHori.PNG', 'dino_color' => 'amarillo'],
                    ['dino_id' => 102, 'species_id' => 2, 'name' => 'T-Rex', 'img' => './img/rojoHori.PNG', 'dino_color' => 'rojo'],
                    ['dino_id' => 103, 'species_id' => 3, 'name' => 'Estegosaurio', 'img' => './img/verdeHori.PNG', 'dino_color' => 'verde'],
                    ['dino_id' => 104, 'species_id' => 4, 'name' => 'Diplodocus', 'img' => './img/azulHori.PNG', 'dino_color' => 'azul']
                ];
            }
            
            foreach ($bagContents as &$dino) {
                if (!isset($dino['dino_id'])) {
                    $dino['dino_id'] = isset($dino['bag_content_id']) ? $dino['bag_content_id'] : 0;
                }
                
                if (!isset($dino['dino_color']) && isset($dino['color'])) {
                    $dino['dino_color'] = $dino['color'];
                } else if (!isset($dino['dino_color'])) {
                    $dino['dino_color'] = 'unknown';
                }
                
                $dino['dino_color'] = $this->mapColorToType($dino['dino_color']);
                
                if (!isset($dino['species_id'])) {
                    $dino['species_id'] = 0;
                }
                
                if (isset($dino['img']) && !str_contains($dino['img'], './img/')) {
                    $dinoColor = $dino['dino_color'];
                    $dino['img'] = "./img/{$dinoColor}Hori.PNG";
                }
            }
            
            return $bagContents;
        } catch (Exception $e) {
            error_log("Error en getBagState: " . $e->getMessage());
            return [
                ['dino_id' => 101, 'species_id' => 1, 'name' => 'Triceratops', 'img' => './img/amarilloHori.PNG', 'dino_color' => 'amarillo'],
                ['dino_id' => 102, 'species_id' => 2, 'name' => 'T-Rex', 'img' => './img/rojoHori.PNG', 'dino_color' => 'rojo'],
                ['dino_id' => 103, 'species_id' => 3, 'name' => 'Estegosaurio', 'img' => './img/verdeHori.PNG', 'dino_color' => 'verde'],
                ['dino_id' => 104, 'species_id' => 4, 'name' => 'Diplodocus', 'img' => './img/azulHori.PNG', 'dino_color' => 'azul']
            ];
        }
    }

    /**
     * Obtiene las colocaciones actuales de un jugador
     */
    private function getPlayerPlacements(int $gameId, int $playerSeat): array 
    {
        return $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat);
    }

    /**
     * Obtiene todas las partidas en progreso de un jugador
     * @param int $userId ID del usuario
     * @return array|null Lista de partidas o null si hay error
     */
    /**
     * Mapea colores de la base de datos a tipos de dinosaurio para la UI
     * @param string $color Color del dinosaurio
     * @return string Tipo correspondiente para la UI
     */
    private function mapColorToType(string $color): string
    {
        $color = strtolower($color);
        
        switch ($color) {
            case 'red': return 'rojo';
            case 'green': return 'verde';
            case 'blue': return 'azul';
            case 'yellow': return 'amarillo';
            case 'orange': return 'naranja';
            case 'pink': return 'rosa';
            case 'rojo': return 'rojo';
            case 'verde': return 'verde';
            case 'azul': return 'azul';
            case 'amarillo': return 'amarillo';
            case 'naranja': return 'naranja';
            case 'rosa': return 'rosa';
            case 'tirex': return 'tirex';
            case 'cafe': return 'cafe';
            case 'bani': return 'bani';
            case 'monta': return 'monta';
            default: return $color; // Devolver el color original si no hay coincidencia
        }
    }
    
    /**
     * Formatea las colocaciones para la UI
     * @param array $placements Colocaciones de la base de datos
     * @return array Colocaciones formateadas para la UI
     */
    private function formatPlacementsForUI(array $placements): array
    {
        // Log para depuración
        error_log("formatPlacementsForUI: Procesando " . count($placements) . " colocaciones");
        
        $formattedEnclosures = [];
        
        // Mapeo de IDs de enclosure (enclosures_id) a los tipos esperados por la UI
        $enclosureIdToTypeMap = [
            // Jugador 1 (player_seat = 0)
            1 => 'IGUAL',   // Bosque de Semejanza
            2 => 'NOIGUAL', // Parado Diferencia
            3 => 'PAREJA',  // Pradera del Amor
            4 => 'TRES',    // Trio Frondoso
            5 => 'REY',     // Rey de la Selva
            6 => 'SOLO',    // Isla Solitaria
            7 => 'RIO',     // Río
            
            // Jugador 2 (player_seat = 1)
            8 => 'IGUAL',   // Bosque de Semejanza (Player 2)
            9 => 'NOIGUAL', // Parado Diferencia (Player 2)
            10 => 'PAREJA', // Pradera del Amor (Player 2)
            11 => 'TRES',   // Trio Frondoso (Player 2)
            12 => 'REY',    // Rey de la Selva (Player 2)
            13 => 'SOLO',   // Isla Solitaria (Player 2)
            14 => 'RIO',    // Río (Player 2)
        ];
        
        // Mapeo de tipos de enclosure (por si se proporciona directamente el tipo)
        $enclosureTypeMap = [
            'same_type' => 'IGUAL',
            'different_type' => 'NOIGUAL',
            'pairs' => 'PAREJA',
            'trio' => 'TRES',
            'king' => 'REY',
            'solo' => 'SOLO',
            'river' => 'RIO',
            // Compatibilidad con nombres ya en el formato esperado
            'IGUAL' => 'IGUAL',
            'NOIGUAL' => 'NOIGUAL',
            'PAREJA' => 'PAREJA',
            'TRES' => 'TRES',
            'REY' => 'REY',
            'SOLO' => 'SOLO',
            'RIO' => 'RIO'
        ];
        
        foreach ($placements as $placement) {
            // Obtener el tipo de recinto, primero intentando con enclosures_id
            $enclosureId = isset($placement['enclosures_id']) ? (int)$placement['enclosures_id'] : 0;
            
            // Determinar el tipo de recinto basado en enclosures_id o enclosure_type
            if ($enclosureId > 0 && isset($enclosureIdToTypeMap[$enclosureId])) {
                // Si tenemos un ID válido, usamos la asignación directa
                $enclosureType = $enclosureIdToTypeMap[$enclosureId];
                error_log("Asignando tipo de recinto desde ID: {$enclosureId} -> {$enclosureType}");
            } else if (isset($placement['enclosure_type'])) {
                // Si no tenemos ID pero sí tipo, usamos el mapeo de tipo
                $enclosureType = $enclosureTypeMap[$placement['enclosure_type']] ?? 'RIO';
                error_log("Asignando tipo de recinto desde tipo: {$placement['enclosure_type']} -> {$enclosureType}");
            } else {
                // Si no tenemos ni ID ni tipo, usamos RIO como fallback
                $enclosureType = 'RIO';
                error_log("No se pudo determinar el tipo de recinto, usando RIO como predeterminado");
            }
            
            // Inicializar el array para este tipo de enclosure si no existe
            if (!isset($formattedEnclosures[$enclosureType])) {
                $formattedEnclosures[$enclosureType] = [];
            }
            
            // Asegurarnos de que el tipo de dinosaurio está correctamente mapeado
            $dinoColor = $placement['dino_color'] ?? $placement['color'] ?? 'unknown';
            $dinosaurType = $this->mapColorToType($dinoColor);
            
            $placementId = isset($placement['placement_id']) ? $placement['placement_id'] : 0;
            error_log("Procesando colocación: ID={$placementId}, Color={$dinoColor}, Tipo Mapeado={$dinosaurType}, Recinto={$enclosureType}, EnclosureID={$enclosureId}");
            
            // Añadir el dinosaurio al enclosure correcto con información enriquecida
            $slotIndex = isset($placement['slot_index']) ? (int)$placement['slot_index'] : 0;
            $dinoId = isset($placement['dino_id']) ? (int)$placement['dino_id'] : 0;
            
            $dinoObject = [
                'id' => $placement['placement_id'] ?? 0,
                'dinosaur_type' => $dinosaurType,
                'orientation' => 'vertical', // Siempre vertical para colocaciones
                'enclosure_type' => $enclosureType,
                'slot_index' => $slotIndex,
                // Información adicional para depuración
                'placement_id' => isset($placement['placement_id']) ? (int)$placement['placement_id'] : 0,
                'enclosure_id' => $enclosureId,
                'dino_id' => $dinoId,
                'species_id' => isset($placement['species_id']) ? (int)$placement['species_id'] : 0,
                'species_code' => $dinoColor
            ];
            
            $formattedEnclosures[$enclosureType][] = $dinoObject;
            
            // Log detallado para depuración
            error_log("Dinosaurio añadido: " . json_encode($dinoObject));
        }
        
        // Log final del resultado
        error_log("Total de tipos de recintos formateados: " . count($formattedEnclosures));
        foreach ($formattedEnclosures as $type => $dinos) {
            error_log("Recinto {$type}: " . count($dinos) . " dinosaurios");
        }
        
        return $formattedEnclosures;
    }
    
    public function getInProgressGames(int $userId): ?array 
    {
        try {
            $games = $this->gameRepo->getInProgressGames($userId);
            
            if (!$games) {
                return null;
            }

            // Enriquecer la información de cada partida
            foreach ($games as &$game) {
                $game['is_active_player'] = (int)$game['active_seat'] === (int)$game['player_seat'];
                $game['can_play'] = $game['is_active_player']; // Por ahora solo puede jugar si es su turno
            }

            return $games;

        } catch (Exception $e) {
            error_log("Error getting in progress games: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Obtiene el historial completo de partidas de un usuario (completadas y pendientes)
     * @param int $userId ID del usuario
     * @return array Lista de todas las partidas
     */
    public function getGameHistory(int $userId): array 
    {
        try {
            $games = $this->gameRepo->getAllGamesByUserId($userId);
            
            if (!$games) {
                error_log("getGameHistory: No se encontraron partidas para el usuario $userId");
                return [];
            }

            error_log("getGameHistory: Se encontraron " . count($games) . " partidas para el usuario $userId");

            // FILTRAR SOLO partidas COMPLETED para el historial
            $completedGames = array_filter($games, function($game) {
                return isset($game['status']) && $game['status'] === 'COMPLETED';
            });
            
            error_log("getGameHistory: " . count($completedGames) . " partidas completadas de " . count($games) . " totales");

            // Enriquecer la información de cada partida COMPLETADA
            foreach ($completedGames as &$game) {
                $gameId = $game['game_id'];
                
                // Obtener información completa de puntajes desde final_score
                $scoresInfo = $this->getGameScoresInfo($gameId, $userId);
                $game['winner_info'] = $scoresInfo['winner'];
                $game['my_score'] = $scoresInfo['my_score'];
                $game['all_scores'] = $scoresInfo['all_scores'];
                
                // Obtener información de oponentes
                $game['opponents'] = $this->getOpponents($gameId, $userId);
                
                // Obtener código de sala si existe
                $game['room_code'] = $this->getRoomCode($gameId);
                
                // Determinar el estado de la partida
                $game['game_status'] = $this->getGameStatus($game, $userId);
                
                // Determinar si el usuario ganó (basado en puntajes reales)
                $game['is_victory'] = $scoresInfo['is_winner'];
                
                // Determinar el asiento del jugador
                $game['player_seat'] = $this->getPlayerSeat($game, $userId);
                
                // Calcular estadísticas básicas (solo para COMPLETED, finished_at debe existir)
                $game['duration_minutes'] = $this->calculateGameDuration($game);
                $game['total_rounds'] = $game['current_round'] ?? 2;
                
                // Determinar si es el turno del usuario (siempre false para COMPLETED)
                $game['is_my_turn'] = false;
                
                error_log("getGameHistory: Partida #$gameId - Status: {$game['status']} | Ganador: " . 
                    ($scoresInfo['winner'] ? $scoresInfo['winner']['username'] : 'Sin datos') . 
                    " | Mi puntaje: " . ($scoresInfo['my_score'] ? $scoresInfo['my_score']['total_points'] : 0) . 
                    " | Gané: " . ($scoresInfo['is_winner'] ? 'SÍ' : 'NO') .
                    " | Duración: {$game['duration_minutes']} min");
            }

            // Retornar solo completadas (array_values para reindexar)
            return array_values($completedGames);

        } catch (Exception $e) {
            error_log("Error getting game history: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return [];
        }
    }
    
    /**
     * Obtiene información completa de puntajes de un juego
     */
    private function getGameScoresInfo(int $gameId, int $userId): array 
    {
        $scores = $this->scoreRepo->getAllScoresForGame($gameId);
        
        if (empty($scores)) {
            error_log("getGameScoresInfo: No se encontraron puntajes para el juego $gameId");
            return [
                'winner' => null,
                'my_score' => null,
                'all_scores' => [],
                'is_winner' => false
            ];
        }
        
        // Ordenar por puntaje descendente, luego por T-Rex (desempate)
        usort($scores, function($a, $b) {
            $scoreDiff = ($b['total_points'] ?? 0) - ($a['total_points'] ?? 0);
            if ($scoreDiff !== 0) {
                return $scoreDiff;
            }
            // Si hay empate en puntos, usar T-Rex como desempate
            return ($b['tiebreaker_trex_count'] ?? 0) - ($a['tiebreaker_trex_count'] ?? 0);
        });
        
        $winner = $scores[0] ?? null;
        $myScore = null;
        $isWinner = false;
        
        // Buscar mi puntaje
        foreach ($scores as $score) {
            if ($score['user_id'] == $userId) {
                $myScore = $score;
                // Verificar si es ganador (mismo puntaje Y mismo T-Rex que el ganador)
                $isWinner = ($score['total_points'] ?? 0) === ($winner['total_points'] ?? 0) &&
                           ($score['tiebreaker_trex_count'] ?? 0) === ($winner['tiebreaker_trex_count'] ?? 0);
                break;
            }
        }
        
        return [
            'winner' => $winner,
            'my_score' => $myScore,
            'all_scores' => $scores,
            'is_winner' => $isWinner
        ];
    }
    
    /**
     * Obtiene la lista de oponentes en una partida con nombres de usuario
     */
    private function getOpponents(int $gameId, int $userId): array 
    {
        // Obtener información del juego con los usernames mediante un JOIN
        $query = "SELECT 
                    g.player1_user_id, u1.username as player1_username,
                    g.player2_user_id, u2.username as player2_username,
                    g.player3_user_id, u3.username as player3_username,
                    g.player4_user_id, u4.username as player4_username,
                    g.player5_user_id, u5.username as player5_username
                  FROM games g
                  LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
                  LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
                  LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
                  LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
                  LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
                  WHERE g.game_id = ?";
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("getOpponents: Error preparing query: " . $this->conn->error);
            return [];
        }
        
        $stmt->bind_param("i", $gameId);
        
        if (!$stmt->execute()) {
            error_log("getOpponents: Error executing query: " . $stmt->error);
            $stmt->close();
            return [];
        }
        
        $result = $stmt->get_result();
        $game = $result ? $result->fetch_assoc() : null;
        if ($result) $result->free();
        $stmt->close();
        
        if (!$game) return [];
        
        $opponents = [];
        
        // Soportar hasta 5 jugadores
        for ($i = 1; $i <= 5; $i++) {
            $playerIdKey = 'player' . $i . '_user_id';
            $usernameKey = 'player' . $i . '_username';
            
            if (isset($game[$playerIdKey]) && $game[$playerIdKey] && $game[$playerIdKey] != $userId) {
                $opponents[] = [
                    'id' => $game[$playerIdKey],
                    'username' => $game[$usernameKey] ?? 'Jugador ' . $i
                ];
            }
        }
        
        return $opponents;
    }
    
    /**
     * Obtiene el código de sala de una partida desde la tabla rooms
     */
    private function getRoomCode(int $gameId): ?string 
    {
        $query = "SELECT room_code FROM rooms WHERE game_id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        
        if (!$stmt) {
            return null;
        }
        
        $stmt->bind_param("i", $gameId);
        
        if (!$stmt->execute()) {
            $stmt->close();
            return null;
        }
        
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;
        if ($result) $result->free();
        $stmt->close();
        
        return $row ? ($row['room_code'] ?? null) : null;
    }
    
    /**
     * Obtiene el asiento del jugador en la partida
     */
    private function getPlayerSeat(array $game, int $userId): int 
    {
        for ($i = 1; $i <= 5; $i++) {
            $playerKey = 'player' . $i . '_user_id';
            if (isset($game[$playerKey]) && $game[$playerKey] == $userId) {
                return $i - 1; // Convertir a 0-indexed
            }
        }
        return 0;
    }

    /**
     * Determina el estado de la partida para mostrar en el historial
     * @param array $game Datos del juego
     * @param int $userId ID del usuario
     * @return string Estado de la partida
     */
    private function getGameStatus(array $game, int $userId): string 
    {
        switch ($game['status']) {
            case 'COMPLETED':
                return $this->didUserWin($game, $userId) ? 'victoria' : 'derrota';
            case 'IN_PROGRESS':
            case 'CREATED':
                return $this->isMyTurn($game, $userId) ? 'mi-turno' : 'turno-oponente';
            default:
                return 'desconocido';
        }
    }

    /**
     * Determina si es el turno del usuario
     * @param array $game Datos del juego
     * @param int $userId ID del usuario
     * @return bool True si es su turno
     */
    private function isMyTurn(array $game, int $userId): bool 
    {
        $player1Id = (int)$game['player1_id'];
        $player2Id = (int)$game['player2_id'];
        $activeSeat = (int)$game['active_seat'];
        
        if ($player1Id === $userId && $activeSeat === 0) return true;
        if ($player2Id === $userId && $activeSeat === 1) return true;
        
        return false;
    }

    /**
     * Determina si el usuario ganó la partida
     * @param array $game Datos del juego
     * @param int $userId ID del usuario
     * @return bool True si ganó, false si no
     */
    private function didUserWin(array $game, int $userId): bool 
    {
        // Por ahora, asumimos que si el juego está completado y el usuario participó, ganó
        // En el futuro se puede implementar lógica más sofisticada basada en puntuaciones
        return true; // Simplificado por ahora
    }

    /**
     * Calcula la duración del juego en minutos
     * @param array $game Datos del juego
     * @return int Duración en minutos
     */
    private function calculateGameDuration(array $game): int 
    {
        if (!isset($game['created_at'])) {
            return 30; // Duración por defecto
        }

        $start = new DateTime($game['created_at']);
        
        // Usar finished_at si existe (juego completado), sino usar NOW (juego en progreso)
        if (isset($game['finished_at']) && $game['finished_at']) {
            $end = new DateTime($game['finished_at']);
        } else {
            $end = new DateTime(); // Ahora
        }
        
        $diff = $start->diff($end);
        
        // Calcular duración total en minutos: días * 24 * 60 + horas * 60 + minutos
        // Esto corrige el bug donde solo se consideraban horas y minutos, ignorando los días
        return ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
    }
}