<?php

require_once __DIR__ . '/../config/Database.php';

class GameRepository
{
    private static ?GameRepository $instance = null;
    private mysqli $conn;

    private function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public static function getInstance(): GameRepository
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Crear una nueva partida
     */
    public function createGame(int $player1_id, ?int $player2_id = null, string $status = 'IN_PROGRESS'): ?int
    {
        $query = "INSERT INTO games (status, player1_user_id, player2_user_id, active_seat, current_turn, current_round, turn_started_at) 
                  VALUES (?, ?, ?, 0, 1, 1, CURRENT_TIMESTAMP)";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("sii", $status, $player1_id, $player2_id);
        $ok = $stmt->execute();

        if (!$ok) {
            $stmt->close();
            return null;
        }

        $game_id = $this->conn->insert_id;
        $stmt->close();

        return $game_id; // Devuelve el id de la partida creada
    }

    /**
     * Obtener datos de una partida por ID
     */
    public function getGameById(int $game_id): ?array
    {
        $query = "SELECT g.game_id, g.status, g.player1_user_id, g.player2_user_id, 
                         g.player3_user_id, g.player4_user_id, g.player5_user_id,
                         g.created_at, g.finished_at, g.active_seat, g.current_turn, 
                         g.current_round, g.turn_started_at,
                         u1.username AS player1_name, u2.username AS player2_name,
                         u3.username AS player3_name, u4.username AS player4_name, u5.username AS player5_name
                  FROM games g
                  LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
                  LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
                  LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
                  LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
                  LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
                  WHERE g.game_id = ?";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("i", $game_id);
        $stmt->execute();

        $result = $stmt->get_result();
        $game = $result ? $result->fetch_assoc() : null;

        if ($result) $result->free();
        $stmt->close();

        return $game ?: null;
    }

    /**
     * Actualizar estado de la partida
     */
    public function updateGameStatus(int $game_id, string $status): bool
    {
        // Si el juego se completa, también actualizar finished_at
        if ($status === 'COMPLETED') {
            $query = "UPDATE games SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE game_id = ?";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) return false;

            $stmt->bind_param("si", $status, $game_id);
        } else {
            $query = "UPDATE games SET status = ? WHERE game_id = ?";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) return false;

            $stmt->bind_param("si", $status, $game_id);
        }
        
        $ok = $stmt->execute();

        $stmt->close();
        return $ok;
    }

    /**
     * Obtiene las partidas en progreso para un usuario
     * @param int $userId ID del usuario
     * @return array Lista de partidas en progreso
     */
    public function getInProgressGamesByUser(int $userId): array {
        $query = "SELECT g.game_id, g.player1_user_id, g.player2_user_id, g.active_seat, 
                         g.current_turn, g.current_round, g.created_at, g.turn_started_at
                  FROM games g
                  WHERE (g.player1_user_id = ? OR g.player2_user_id = ?)
                  AND g.status = 'IN_PROGRESS'
                  ORDER BY g.turn_started_at DESC";
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];
        
        $stmt->bind_param("ii", $userId, $userId);
        $stmt->execute();
        
        $result = $stmt->get_result();
        $games = [];
        
        while ($row = $result->fetch_assoc()) {
            $games[] = $row;
        }
        
        $result->free();
        $stmt->close();
        
        return $games;
    }
    
    /**
     * Obtiene información de un usuario por ID
     * @param int $userId ID del usuario
     * @return array|null Datos del usuario o null si no existe
     */
    public function getUserById(int $userId): ?array {
        $query = "SELECT user_id, username FROM users WHERE user_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;
        
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        
        $result = $stmt->get_result();
        $user = $result ? $result->fetch_assoc() : null;
        
        if ($result) $result->free();
        $stmt->close();
        
        return $user ?: null;
    }

    /**
     * Actualiza el estado del juego
     * @param int $gameId ID del juego
     * @param int $activeSeat Asiento del jugador activo (0 o 1)
     * @param int $currentTurn Turno actual (1-6)
     * @param int $currentRound Ronda actual (1-2)
     * @return bool true si la actualización fue exitosa
     */
    public function updateGameState(int $gameId, int $activeSeat, int $currentTurn, int $currentRound): bool {
        $query = "UPDATE games 
                 SET active_seat = ?, 
                     current_turn = ?, 
                     current_round = ?,
                     turn_started_at = CURRENT_TIMESTAMP
                 WHERE game_id = ?";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param("iiii", $activeSeat, $currentTurn, $currentRound, $gameId);
        $success = $stmt->execute();
        $stmt->close();

        return $success;
    }

    /**
     * Obtiene las partidas en progreso de un usuario
     * @param int $userId ID del usuario
     * @return array|null Array de partidas o null si hay error
     */
    public function getInProgressGames(int $userId): ?array 
    {
        $query = "
            SELECT 
                g.game_id,
                g.current_round,
                g.current_turn,
                g.active_seat,
                g.created_at,
                CASE 
                    WHEN g.player1_user_id = ? THEN 0
                    ELSE 1
                END as player_seat,
                u1.username as player1_username,
                u2.username as player2_username
            FROM games g
            JOIN users u1 ON g.player1_user_id = u1.user_id
            JOIN users u2 ON g.player2_user_id = u2.user_id
            WHERE (g.player1_user_id = ? OR g.player2_user_id = ?)
            AND g.status = 'IN_PROGRESS'
            ORDER BY g.created_at DESC
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("iii", $userId, $userId, $userId);
        $stmt->execute();

        $result = $stmt->get_result();
        $games = $result ? $result->fetch_all(MYSQLI_ASSOC) : null;

        if ($result) $result->free();
        $stmt->close();

        return $games ?: null;
    }

    /**
     * Obtener todas las partidas de un usuario (completadas y pendientes)
     */
    public function getAllGamesByUserId(int $userId): array 
    {
        $query = "
            SELECT 
                g.game_id,
                g.current_round,
                g.current_turn,
                g.active_seat,
                g.created_at,
                g.finished_at,
                g.status,
                CASE 
                    WHEN g.player1_user_id = ? THEN 0
                    WHEN g.player2_user_id = ? THEN 1
                    WHEN g.player3_user_id = ? THEN 2
                    WHEN g.player4_user_id = ? THEN 3
                    WHEN g.player5_user_id = ? THEN 4
                    ELSE NULL
                END as player_seat,
                u1.username as player1_username,
                u2.username as player2_username,
                u3.username as player3_username,
                u4.username as player4_username,
                u5.username as player5_username,
                u1.user_id as player1_id,
                u2.user_id as player2_id,
                u3.user_id as player3_id,
                u4.user_id as player4_id,
                u5.user_id as player5_id
            FROM games g
            LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
            LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
            LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
            LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
            LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
            WHERE (
                g.player1_user_id = ? OR 
                g.player2_user_id = ? OR 
                g.player3_user_id = ? OR 
                g.player4_user_id = ? OR 
                g.player5_user_id = ?
            )
            AND g.status IN ('COMPLETED', 'IN_PROGRESS', 'CREATED')
            ORDER BY COALESCE(g.finished_at, g.created_at) DESC
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];

        $stmt->bind_param("iiiiiiiiii", $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId);
        $stmt->execute();

        $result = $stmt->get_result();
        $games = [];

        while ($row = $result->fetch_assoc()) {
            // Agregar lista de oponentes si existen
            $opponents = [];
            for ($i = 1; $i <= 5; $i++) {
                $idKey = "player{$i}_id";
                $nameKey = "player{$i}_username";
                if (!empty($row[$idKey])) {
                    $opponents[] = [
                        'id' => $row[$idKey],
                        'username' => $row[$nameKey]
                    ];
                }
            }
            $row['opponents'] = $opponents;
            $games[] = $row;
        }

        if ($result) $result->free();
        $stmt->close();

        return $games;
    }

    /**
     * Obtener historial de partidas completadas con información completa
     */
    public function getGameHistory(int $userId): array 
    {
        $query = "
            SELECT 
                g.game_id,
                g.created_at,
                g.finished_at,
                g.current_round,
                g.current_turn,
                g.status,
                r.room_id,
                r.room_code,
                u1.user_id as player1_id,
                u1.username as player1_username,
                u2.user_id as player2_id,
                u2.username as player2_username,
                u3.user_id as player3_id,
                u3.username as player3_username,
                u4.user_id as player4_id,
                u4.username as player4_username,
                u5.user_id as player5_id,
                u5.username as player5_username,
                CASE 
                    WHEN g.player1_user_id = ? THEN 0
                    WHEN g.player2_user_id = ? THEN 1
                    WHEN g.player3_user_id = ? THEN 2
                    WHEN g.player4_user_id = ? THEN 3
                    WHEN g.player5_user_id = ? THEN 4
                END as player_seat,
                -- Calcular duración solo para juegos completados (usar finished_at, no NOW)
                CASE 
                    WHEN g.finished_at IS NOT NULL THEN 
                        TIMESTAMPDIFF(MINUTE, g.created_at, g.finished_at)
                    ELSE 
                        TIMESTAMPDIFF(MINUTE, g.created_at, NOW())
                END as duration_minutes
            FROM games g
            -- LEFT JOIN para obtener nombres de jugadores
            LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
            LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
            LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
            LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
            LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
            -- LEFT JOIN para obtener información de sala (puede no existir)
            LEFT JOIN rooms r ON r.game_id = g.game_id
            WHERE (
                g.player1_user_id = ? OR 
                g.player2_user_id = ? OR 
                g.player3_user_id = ? OR 
                g.player4_user_id = ? OR 
                g.player5_user_id = ?
            )
            -- Solo mostrar juegos completados en el historial
            AND g.status = 'COMPLETED'
            -- Ordenar por fecha de finalización descendente (más recientes primero)
            ORDER BY 
                COALESCE(g.finished_at, g.created_at) DESC,
                g.game_id DESC
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("Error preparing getGameHistory query: " . $this->conn->error);
            return [];
        }

        $stmt->bind_param("iiiiiiiii", $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId);
        
        if (!$stmt->execute()) {
            error_log("Error executing getGameHistory query: " . $stmt->error);
            $stmt->close();
            return [];
        }

        $result = $stmt->get_result();
        $games = [];

        while ($row = $result->fetch_assoc()) {
            // Agregar información de oponentes
            $opponents = [];
            for ($i = 1; $i <= 5; $i++) {
                $playerId = "player{$i}_id";
                $playerUsername = "player{$i}_username";
                if (!empty($row[$playerId])) {
                    $opponents[] = [
                        'id' => $row[$playerId],
                        'username' => $row[$playerUsername]
                    ];
                }
            }
            $row['opponents'] = $opponents;
            
            // Agregar información del ganador (el jugador con más puntos)
            $row['winner_info'] = $this->getGameWinner($row['game_id']);
            
            // Agregar información de TODOS los puntajes de la partida
            $row['all_scores'] = $this->getAllGameScores($row['game_id']);
            
            // Agregar el puntaje del usuario actual
            $row['my_score'] = $this->getPlayerScore($row['game_id'], $userId);
            
            $games[] = $row;
        }

        if ($result) $result->free();
        $stmt->close();

        return $games;
    }

    /**
     * Obtener información del ganador de una partida
     * Devuelve TODOS los jugadores con sus puntos ordenados por puntuación
     */
    private function getGameWinner(int $gameId): ?array 
    {
        // IMPORTANTE: Ordenar por total_points DESC, luego por tiebreaker_trex_count DESC
        // Esto asegura que en caso de empate, gane quien tenga más T-Rex
        $query = "
            SELECT 
                fs.player_seat,
                fs.total_points,
                fs.river_points,
                fs.trex_bonus_points,
                fs.tiebreaker_trex_count,
                u.user_id,
                u.username
            FROM final_score fs
            LEFT JOIN games g ON fs.game_id = g.game_id
            LEFT JOIN users u ON (
                (fs.player_seat = 0 AND g.player1_user_id = u.user_id) OR
                (fs.player_seat = 1 AND g.player2_user_id = u.user_id) OR
                (fs.player_seat = 2 AND g.player3_user_id = u.user_id) OR
                (fs.player_seat = 3 AND g.player4_user_id = u.user_id) OR
                (fs.player_seat = 4 AND g.player5_user_id = u.user_id)
            )
            WHERE fs.game_id = ?
            ORDER BY fs.total_points DESC, fs.tiebreaker_trex_count DESC
            LIMIT 1
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("i", $gameId);
        $stmt->execute();

        $result = $stmt->get_result();
        $winner = $result ? $result->fetch_assoc() : null;

        if ($result) $result->free();
        $stmt->close();

        return $winner;
    }

    /**
     * Obtener TODOS los puntajes de una partida
     * @param int $gameId ID de la partida
     * @return array Array con todos los puntajes ordenados de mayor a menor
     */
    private function getAllGameScores(int $gameId): array 
    {
        $query = "
            SELECT 
                fs.player_seat,
                fs.total_points,
                fs.river_points,
                fs.trex_bonus_points,
                fs.tiebreaker_trex_count,
                u.user_id,
                u.username
            FROM final_score fs
            LEFT JOIN games g ON fs.game_id = g.game_id
            LEFT JOIN users u ON (
                (fs.player_seat = 0 AND g.player1_user_id = u.user_id) OR
                (fs.player_seat = 1 AND g.player2_user_id = u.user_id) OR
                (fs.player_seat = 2 AND g.player3_user_id = u.user_id) OR
                (fs.player_seat = 3 AND g.player4_user_id = u.user_id) OR
                (fs.player_seat = 4 AND g.player5_user_id = u.user_id)
            )
            WHERE fs.game_id = ?
            ORDER BY fs.total_points DESC, fs.tiebreaker_trex_count DESC
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];

        $stmt->bind_param("i", $gameId);
        $stmt->execute();

        $result = $stmt->get_result();
        $scores = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];

        if ($result) $result->free();
        $stmt->close();

        return $scores;
    }

    /**
     * Obtener el puntaje de un jugador específico en una partida
     * @param int $gameId ID de la partida
     * @param int $userId ID del usuario
     * @return array|null Información del puntaje o null si no se encuentra
     */
    private function getPlayerScore(int $gameId, int $userId): ?array 
    {
        $query = "
            SELECT 
                fs.player_seat,
                fs.total_points,
                fs.river_points,
                fs.trex_bonus_points
            FROM final_score fs
            JOIN games g ON fs.game_id = g.game_id
            WHERE fs.game_id = ?
            AND (
                (fs.player_seat = 0 AND g.player1_user_id = ?) OR
                (fs.player_seat = 1 AND g.player2_user_id = ?) OR
                (fs.player_seat = 2 AND g.player3_user_id = ?) OR
                (fs.player_seat = 3 AND g.player4_user_id = ?) OR
                (fs.player_seat = 4 AND g.player5_user_id = ?)
            )
            LIMIT 1
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("iiiiii", $gameId, $userId, $userId, $userId, $userId, $userId);
        $stmt->execute();

        $result = $stmt->get_result();
        $score = $result ? $result->fetch_assoc() : null;

        if ($result) $result->free();
        $stmt->close();

        return $score;
    }

    /**
     * Obtener puntuaciones de una partida
     */
    public function getGameScores(int $gameId): array 
    {
        $query = "
            SELECT 
                fs.player_seat,
                fs.total_points,
                u.user_id,
                u.username
            FROM final_score fs
            LEFT JOIN games g ON fs.game_id = g.game_id
            LEFT JOIN users u ON (
                (fs.player_seat = 0 AND g.player1_user_id = u.user_id) OR
                (fs.player_seat = 1 AND g.player2_user_id = u.user_id) OR
                (fs.player_seat = 2 AND g.player3_user_id = u.user_id) OR
                (fs.player_seat = 3 AND g.player4_user_id = u.user_id) OR
                (fs.player_seat = 4 AND g.player5_user_id = u.user_id)
            )
            WHERE fs.game_id = ?
            ORDER BY fs.player_seat
        ";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];

        $stmt->bind_param("i", $gameId);
        $stmt->execute();

        $result = $stmt->get_result();
        $scores = [];

        while ($row = $result->fetch_assoc()) {
            $scores[] = $row;
        }

        if ($result) $result->free();
        $stmt->close();

        return $scores;
    }
}
