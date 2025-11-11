<?php

require_once __DIR__ . '/../config/Database.php';

class FinalScoreRepository
{
    private static ?FinalScoreRepository $instance = null;
    private mysqli $conn;

    private function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public static function getInstance(): FinalScoreRepository
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // -----------------------------
    // Guardar puntaje de un jugador en una partida
    // -----------------------------
    public function saveScore(int $gameId, int $playerSeat, int $totalPoints, int $riverPoints = 0, int $trexBonusPoints = 0, int $tiebreakerTrexCount = 0, bool $accumulate = false): bool
    {
        if ($accumulate) {
            // ACUMULAR: Sumar los nuevos puntajes a los existentes
            $query = "INSERT INTO final_score 
                      (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, NOW())
                      ON DUPLICATE KEY UPDATE
                      total_points = total_points + VALUES(total_points),
                      river_points = river_points + VALUES(river_points),
                      trex_bonus_points = trex_bonus_points + VALUES(trex_bonus_points),
                      tiebreaker_trex_count = tiebreaker_trex_count + VALUES(tiebreaker_trex_count)";
        } else {
            // SOBRESCRIBIR: Reemplazar los puntajes (comportamiento por defecto)
            $query = "INSERT INTO final_score 
                      (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, NOW())
                      ON DUPLICATE KEY UPDATE
                      total_points = VALUES(total_points),
                      river_points = VALUES(river_points),
                      trex_bonus_points = VALUES(trex_bonus_points),
                      tiebreaker_trex_count = VALUES(tiebreaker_trex_count)";
        }

        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param(
            "iiiiii",
            $gameId,
            $playerSeat,
            $totalPoints,
            $riverPoints,
            $trexBonusPoints,
            $tiebreakerTrexCount
        );

        $ok = $stmt->execute();
        $stmt->close();

        return $ok;
    }

    // -----------------------------
    // Obtener puntaje de un jugador en una partida
    // -----------------------------
    public function getScore(int $gameId, int $playerSeat): ?array
    {
        $query = "SELECT * FROM final_score WHERE game_id = ? AND player_seat = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("ii", $gameId, $playerSeat);
        $stmt->execute();

        $result = $stmt->get_result();
        $score = $result ? $result->fetch_assoc() : null;

        if ($result) $result->free();
        $stmt->close();

        return $score ?: null;
    }

    // -----------------------------
    // Obtener todos los puntajes de una partida
    // -----------------------------
    public function getScoresByGame(int $gameId): array
    {
        $query = "SELECT * FROM final_score WHERE game_id = ?";
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

    // -----------------------------
    // Obtener todos los puntajes de una partida CON información de usuarios
    // -----------------------------
    public function getAllScoresForGame(int $gameId): array
    {
        // JOIN con games y users para obtener información completa
        $query = "SELECT 
                    fs.game_id,
                    fs.player_seat,
                    fs.total_points,
                    fs.river_points,
                    fs.trex_bonus_points,
                    fs.tiebreaker_trex_count,
                    CASE 
                        WHEN fs.player_seat = 0 THEN g.player1_user_id
                        WHEN fs.player_seat = 1 THEN g.player2_user_id
                        WHEN fs.player_seat = 2 THEN g.player3_user_id
                        WHEN fs.player_seat = 3 THEN g.player4_user_id
                        WHEN fs.player_seat = 4 THEN g.player5_user_id
                    END as user_id,
                    CASE 
                        WHEN fs.player_seat = 0 THEN u1.username
                        WHEN fs.player_seat = 1 THEN u2.username
                        WHEN fs.player_seat = 2 THEN u3.username
                        WHEN fs.player_seat = 3 THEN u4.username
                        WHEN fs.player_seat = 4 THEN u5.username
                    END as username
                  FROM final_score fs
                  JOIN games g ON fs.game_id = g.game_id
                  LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
                  LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
                  LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
                  LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
                  LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
                  WHERE fs.game_id = ?
                  ORDER BY fs.total_points DESC, fs.tiebreaker_trex_count DESC";
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("getAllScoresForGame: Error preparing statement: " . $this->conn->error);
            return [];
        }

        $stmt->bind_param("i", $gameId);
        
        if (!$stmt->execute()) {
            error_log("getAllScoresForGame: Error executing query: " . $stmt->error);
            $stmt->close();
            return [];
        }

        $result = $stmt->get_result();
        $scores = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];

        if ($result) $result->free();
        $stmt->close();

        error_log("getAllScoresForGame: Encontrados " . count($scores) . " puntajes para game_id=$gameId");

        return $scores;
    }
}

?>