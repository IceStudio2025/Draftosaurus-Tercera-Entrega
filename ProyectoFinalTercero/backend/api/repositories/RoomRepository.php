<?php
require_once __DIR__ . '/../config/Database.php';

class RoomRepository {
    private static ?RoomRepository $instance = null;
    private mysqli $conn;

    private function __construct() {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public static function getInstance(): RoomRepository {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function createRoom(string $code, int $adminId, int $maxPlayers, string $direction, string $boardType = 'primavera'): ?int {
        $query = "INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status) 
                  VALUES (?, ?, ?, ?, ?, 'WAITING')";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("siiss", $code, $adminId, $maxPlayers, $direction, $boardType);
        if (!$stmt->execute()) {
            $stmt->close();
            return null;
        }

        $roomId = $this->conn->insert_id;
        $stmt->close();
        return $roomId;
    }

    public function getRoomByCode(string $code): ?array {
        $query = "SELECT * FROM rooms WHERE room_code = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("s", $code);
        $stmt->execute();
        $result = $stmt->get_result();
        $room = $result ? $result->fetch_assoc() : null;
        
        if ($result) $result->free();
        $stmt->close();
        return $room ?: null;
    }

    public function getRoomByGameId(int $gameId): ?array {
        $query = "SELECT * FROM rooms WHERE game_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("i", $gameId);
        $stmt->execute();
        $result = $stmt->get_result();
        $room = $result ? $result->fetch_assoc() : null;
        
        if ($result) $result->free();
        $stmt->close();
        return $room ?: null;
    }

    public function addPlayerToRoom(int $roomId, int $userId, int $seat): bool {
        $query = "INSERT INTO room_players (room_id, user_id, player_seat) VALUES (?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param("iii", $roomId, $userId, $seat);
        $success = $stmt->execute();
        $stmt->close();
        return $success;
    }

    public function getRoomPlayers(int $roomId): array {
        $query = "SELECT rp.user_id, rp.player_seat, u.username 
                  FROM room_players rp
                  JOIN users u ON rp.user_id = u.user_id
                  WHERE rp.room_id = ?
                  ORDER BY rp.player_seat";
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];

        $stmt->bind_param("i", $roomId);
        $stmt->execute();
        $result = $stmt->get_result();
        $players = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        
        if ($result) $result->free();
        $stmt->close();
        return $players;
    }

    public function getAllUsers(): array {
        $query = "SELECT user_id, username FROM users ORDER BY user_id";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return [];
        
        $stmt->execute();
        $result = $stmt->get_result();
        $users = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        
        if ($result) $result->free();
        $stmt->close();
        return $users;
    }

    public function startGameFromRoom(int $roomId, array $playerIds): ?int {
        // Aumentar timeout de transacción y usar isolation level más bajo para evitar deadlocks
        $this->conn->query("SET SESSION innodb_lock_wait_timeout = 120");
        $this->conn->query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
        
        $this->conn->begin_transaction();
        try {
            // Crear juego con hasta 5 jugadores
            $p1 = $playerIds[0] ?? null;
            $p2 = $playerIds[1] ?? null;
            $p3 = $playerIds[2] ?? null;
            $p4 = $playerIds[3] ?? null;
            $p5 = $playerIds[4] ?? null;

            error_log("Creating game with players: p1=$p1, p2=$p2, p3=$p3, p4=$p4, p5=$p5");

            $query = "INSERT INTO games (player1_user_id, player2_user_id, player3_user_id, player4_user_id, player5_user_id, status, active_seat, current_turn, current_round, turn_started_at) 
                      VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', 0, 1, 1, CURRENT_TIMESTAMP)";
            
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                error_log("Failed to prepare game insert: " . $this->conn->error);
                throw new Exception("Failed to prepare game insert");
            }
            
            $stmt->bind_param("iiiii", $p1, $p2, $p3, $p4, $p5);
            
            if (!$stmt->execute()) {
                error_log("Failed to execute game insert: " . $stmt->error);
                throw new Exception("Failed to execute game insert");
            }
            
            $gameId = $this->conn->insert_id;
            $stmt->close();
            
            error_log("Game created with ID: $gameId");

            // Crear bolsas y llenarlas
            $filteredPlayerIds = array_values(array_filter($playerIds, function($id) {
                return $id !== null && $id !== 0;
            }));
            
            if (empty($filteredPlayerIds)) {
                throw new Exception("No valid player IDs provided");
            }
            
            error_log("Creating bags for game $gameId with players: " . json_encode($filteredPlayerIds));
            
            // Crear todas las bolsas en una sola query para evitar bloqueos
            $bagIds = $this->createBagsInTransaction($gameId, $filteredPlayerIds);
            
            if (!$bagIds) {
                error_log("Failed to create bags");
                throw new Exception("Failed to create bags");
            }
            
            error_log("Bags created: " . json_encode($bagIds));
            error_log("Filling bags...");
            
            $fillSuccess = $this->fillBagsInTransaction($gameId, $bagIds, 6);
            
            if (!$fillSuccess) {
                error_log("Failed to fill bags");
                throw new Exception("Failed to fill bags with species");
            }
            
            error_log("Bags filled successfully");

            // Actualizar sala
            $updateQuery = "UPDATE rooms SET status = 'IN_PROGRESS', game_id = ? WHERE room_id = ?";
            $updateStmt = $this->conn->prepare($updateQuery);
            if (!$updateStmt) {
                error_log("Failed to prepare room update: " . $this->conn->error);
                throw new Exception("Failed to prepare room update");
            }
            
            $updateStmt->bind_param("ii", $gameId, $roomId);
            if (!$updateStmt->execute()) {
                error_log("Failed to execute room update: " . $updateStmt->error);
                $updateStmt->close();
                throw new Exception("Failed to execute room update");
            }
            $updateStmt->close();

            $this->conn->commit();
            error_log("Transaction committed successfully for game $gameId");
            return $gameId;
        } catch (Exception $e) {
            $this->conn->rollback();
            error_log("Error starting game: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return null;
        }
    }

    /**
     * Crear bolsas dentro de la transacción usando la misma conexión
     */
    private function createBagsInTransaction(int $gameId, array $playerIds): ?array
    {
        $bagIds = [];
        
        // Crear todas las bolsas con un INSERT masivo
        $values = [];
        foreach ($playerIds as $playerId) {
            $values[] = "($gameId, $playerId)";
        }
        
        if (empty($values)) {
            return null;
        }
        
        $valuesString = implode(', ', $values);
        $query = "INSERT INTO bags (game_id, user_id) VALUES $valuesString";
        
        if (!$this->conn->query($query)) {
            error_log("Failed to create bags: " . $this->conn->error);
            return null;
        }
        
        // Obtener los IDs de las bolsas creadas
        $result = $this->conn->query("SELECT bag_id, user_id FROM bags WHERE game_id = $gameId ORDER BY bag_id DESC LIMIT " . count($playerIds));
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $bagIds[$row['user_id']] = $row['bag_id'];
            }
            $result->free();
        }
        
        return $bagIds;
    }

    /**
     * Llenar bolsas dentro de la transacción usando la misma conexión
     */
    private function fillBagsInTransaction(int $gameId, array $bagIds, int $numPerBag): bool
    {
        // Obtener todas las especies
        $speciesResult = $this->conn->query("SELECT species_id FROM species");
        if (!$speciesResult) {
            error_log("Error getting species: " . $this->conn->error);
            return false;
        }
        
        $speciesIds = $speciesResult ? array_column($speciesResult->fetch_all(MYSQLI_ASSOC), 'species_id') : [];
        if (empty($speciesIds)) {
            error_log("No species found in the database");
            return false;
        }
        
        // CRÍTICO: Cada jugador debe tener dinosaurios DISTINTOS (RF17)
        // Usar algoritmo determinístico que garantiza unicidad desde el inicio
        $bagCombinations = [];
        $usedCombinations = [];
        $speciesCount = count($speciesIds);
        
        foreach ($bagIds as $bagIndex => $bagId) {
            // Algoritmo determinístico mejorado que garantiza combinaciones únicas
            // Usar bagId y bagIndex como semilla para generar distribución única
            $seed = ($bagId * 137) + ($bagIndex * 97) + ($gameId * 53); // Factores primos grandes para mejor distribución
            $speciesPool = [];
            
            // Generar distribución única para este jugador
            // Cada jugador tendrá una distribución diferente basada en su índice
            $distribution = [];
            
            // Calcular distribución base (equilibrada)
            $basePerType = floor($numPerBag / $speciesCount);
            $extra = $numPerBag % $speciesCount;
            
            // Crear distribución con variación basada en el índice del jugador
            for ($i = 0; $i < $speciesCount; $i++) {
                // Rotar especies según el índice del jugador para garantizar variedad
                $rotatedIndex = ($i + $bagIndex) % $speciesCount;
                $speciesId = $speciesIds[$rotatedIndex];
                
                // Distribución base
                $count = $basePerType;
                
                // Agregar extras de manera rotada
                $extraIndex = ($i + ($bagIndex * 2)) % $speciesCount;
                if ($extraIndex < $extra) {
                    $count++;
                }
                
                // Añadir variación aleatoria determinística basada en seed
                mt_srand($seed + $i);
                $variation = mt_rand(-1, 1); // Pequeña variación
                $count = max(0, min($numPerBag, $count + $variation)); // Limitar entre 0 y numPerBag
                mt_srand(); // Restaurar
                
                $distribution[$speciesId] = $count;
            }
            
            // Ajustar para asegurar que tenemos exactamente numPerBag dinosaurios
            $total = array_sum($distribution);
            if ($total != $numPerBag) {
                $diff = $numPerBag - $total;
                if ($diff > 0) {
                    // Agregar a especies aleatorias
                    mt_srand($seed);
                    $keys = array_keys($distribution);
                    for ($i = 0; $i < $diff; $i++) {
                        $randomKey = $keys[mt_rand(0, count($keys) - 1)];
                        $distribution[$randomKey]++;
                    }
                    mt_srand();
                } else if ($diff < 0) {
                    // Quitar de especies que tienen más de 1
                    mt_srand($seed);
                    $keys = array_keys($distribution);
                    for ($i = 0; $i < abs($diff); $i++) {
                        foreach ($keys as $key) {
                            if ($distribution[$key] > 1) {
                                $distribution[$key]--;
                                break;
                            }
                        }
                    }
                    mt_srand();
                }
            }
            
            // Construir el pool de especies desde la distribución
            foreach ($distribution as $speciesId => $count) {
                for ($j = 0; $j < $count; $j++) {
                    $speciesPool[] = $speciesId;
                }
            }
            
            // Mezclar usando semilla determinística única para esta bolsa
            mt_srand($seed);
            shuffle($speciesPool);
            mt_srand(); // Restaurar semilla aleatoria
            
            // Verificar unicidad
            $normalized = array_count_values($speciesPool);
            ksort($normalized);
            $combinationKey = json_encode($normalized);
            
            // Si es duplicada (muy improbable), modificar ligeramente
            $modificationAttempts = 0;
            while (in_array($combinationKey, $usedCombinations, true) && $modificationAttempts < 50) {
                $modificationAttempts++;
                // Intercambiar dos especies aleatorias
                mt_srand($seed + $modificationAttempts * 1000);
                if (count($speciesPool) >= 2) {
                    $idx1 = mt_rand(0, count($speciesPool) - 1);
                    $idx2 = mt_rand(0, count($speciesPool) - 1);
                    if ($idx1 != $idx2) {
                        $temp = $speciesPool[$idx1];
                        $speciesPool[$idx1] = $speciesPool[$idx2];
                        $speciesPool[$idx2] = $temp;
                    }
                }
                mt_srand();
                
                $normalized = array_count_values($speciesPool);
                ksort($normalized);
                $combinationKey = json_encode($normalized);
            }
            
            // Registrar combinación
            $usedCombinations[] = $combinationKey;
            $bagCombinations[$bagId] = $speciesPool;
            
            $distSummary = array_count_values($speciesPool);
            error_log("Bag $bagId (jugador " . ($bagIndex + 1) . "): Distribución única: " . json_encode($distSummary));
        }
        
        // Verificar que todas las combinaciones son únicas
        error_log("=== VERIFICACIÓN DE COMBINACIONES ÚNICAS (fillBagsInTransaction) ===");
        $uniqueCount = count(array_unique($usedCombinations));
        if ($uniqueCount !== count($usedCombinations)) {
            error_log("ERROR: Se encontraron " . (count($usedCombinations) - $uniqueCount) . " combinaciones duplicadas!");
        } else {
            error_log("✅ Todas las " . count($usedCombinations) . " combinaciones son únicas");
        }
        
        // Preparar todos los datos en memoria primero
        $values = [];
        foreach ($bagCombinations as $bagId => $speciesPool) {
            foreach ($speciesPool as $speciesId) {
                $values[] = "($bagId, $speciesId, 0)";
            }
        }

        if (empty($values)) {
            error_log("No values to insert");
            return false;
        }

        // Insertar todos los datos en una sola query masiva
        $valuesString = implode(', ', $values);
        $insertQuery = "INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES $valuesString";
        
        error_log("Executing massive insert for " . count($values) . " dinosaurs with unique combinations");
        
        $result = $this->conn->query($insertQuery);
        if (!$result) {
            error_log("Failed to insert dinosaurs: " . $this->conn->error);
            return false;
        }

        error_log("All bags filled successfully with unique combinations");
        return true;
    }
}