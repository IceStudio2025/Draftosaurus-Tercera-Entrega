<?php

require_once __DIR__ . '/../config/Database.php';

class BagRepository
{
    private static ?BagRepository $instance = null;
    private mysqli $conn;
    private $lastError = '';

    private function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }
    
    /**
     * Get the last error message
     * @return string Last error message
     */
    public function getLastError()
    {
        return $this->lastError;
    }

    public static function getInstance(): BagRepository
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Obtiene el species_id de un registro de bag_contents
     */
    public function getSpeciesIdByBagContentId(int $bagContentId): ?int
    {
        // Permitir IDs de prueba devolviendo una especie por defecto
        if ($bagContentId >= 100 && $bagContentId <= 110) {
            return 1; // por defecto
        }

        $query = "SELECT species_id FROM bag_contents WHERE bag_content_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("i", $bagContentId);
        if (!$stmt->execute()) {
            $stmt->close();
            return null;
        }

        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;
        if ($result) $result->free();
        $stmt->close();

        return $row && isset($row['species_id']) ? (int)$row['species_id'] : null;
    }

    /**
     * Crear una bolsa para un jugador dentro de una partida
     */
    public function createBag(int $game_id, int $user_id): ?int
    {
        $query = "INSERT INTO bags (game_id, user_id) VALUES (?, ?)";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("ii", $game_id, $user_id);
        $ok = $stmt->execute();

        if (!$ok) {
            $stmt->close();
            return null;
        }

        $bag_id = $this->conn->insert_id;
        $stmt->close();

        return $bag_id; // Devuelve el id de la bolsa creada
    }

    public function createBagsForGame(int $gameId, array $playerIds): ?array
    {
        $bagIds = [];

        foreach ($playerIds as $playerId) {
            $bagId = $this->createBag($gameId, $playerId);
            if (!$bagId) {
                // Si falla, eliminar las bolsas creadas hasta ahora
                foreach ($bagIds as $createdBagId) {
                    $this->deleteBag($createdBagId);
                }
                return null;
            }
            $bagIds[$playerId] = $bagId;
        }

        return $bagIds;
    }

    /**
     * Insertar dinosaurio en una bolsa
     */
    public function addDinoToBag(int $bag_id, int $species_id): ?int
    {
        $query = "INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES (?, ?, 0)";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;

        $stmt->bind_param("ii", $bag_id, $species_id);
        $ok = $stmt->execute();

        if (!$ok) {
            $stmt->close();
            return null;
        }

        $bag_content_id = $this->conn->insert_id;
        $stmt->close();

        return $bag_content_id;
    }

    /**
     * Obtener contenido de la bolsa
     */
    public function getBagContents(int $bag_id, bool $onlyUnplayed = false): array
    {
        $sql = "SELECT bc.bag_content_id, bc.species_id, s.name, s.img, bc.is_played
                FROM bag_contents bc
                JOIN species s ON bc.species_id = s.species_id
                WHERE bc.bag_id = ?";
        if ($onlyUnplayed) {
            $sql .= " AND bc.is_played = 0";
        }

        $stmt = $this->conn->prepare($sql);
        if (!$stmt) return [];

        $stmt->bind_param("i", $bag_id);
        $stmt->execute();

        $result = $stmt->get_result();
        $contents = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];

        if ($result) $result->free();
        $stmt->close();

        return $contents;
    }

    /**
     * Marcar un dinosaurio como jugado
     */
    public function markDinoPlayed(int $bag_content_id): bool
    {
        // Ignorar los IDs de prueba (100-110)
        if ($bag_content_id >= 100 && $bag_content_id <= 110) {
            error_log("ID de prueba detectado ($bag_content_id), ignorando markDinoPlayed");
            return true;
        }
        
        $query = "UPDATE bag_contents SET is_played = 1 WHERE bag_content_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param("i", $bag_content_id);
        $ok = $stmt->execute();
        
        if (!$ok) {
            error_log("Error al marcar dino como jugado: " . $this->conn->error);
        }

        $stmt->close();
        return $ok;
    }

    /**
     * Verifica si un dinosaurio de la bolsa ya fue jugado
     */
    public function isDinoPlayed(int $bagContentId): bool
    {
        // Ignorar los IDs de prueba (100-110)
        if ($bagContentId >= 100 && $bagContentId <= 110) {
            error_log("ID de prueba detectado ($bagContentId), ignorando isDinoPlayed");
            return false;
        }
        
        $query = "SELECT is_played FROM bag_contents WHERE bag_content_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param("i", $bagContentId);
        $stmt->execute();

        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;

        if ($result) $result->free();
        $stmt->close();

        return isset($row['is_played']) && (bool)$row['is_played'];
    }

    /**
     * Eliminar toda la bolsa de un jugador
     */
    public function deleteBag(int $bag_id): bool
    {
        $query = "DELETE FROM bags WHERE bag_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return false;

        $stmt->bind_param("i", $bag_id);
        $ok = $stmt->execute();

        $stmt->close();
        return $ok;
    }

    /**
     * Limpiar los contenidos de una bolsa
     * @param int $bagId ID de la bolsa
     * @param bool $onlyUnplayed Si true, solo elimina los no jugados; si false, elimina TODOS
     */
    public function clearBagContents(int $bagId, bool $onlyUnplayed = true): bool
    {
        // Construir la query según el tipo de limpieza
        if ($onlyUnplayed) {
            $query = "DELETE FROM bag_contents WHERE bag_id = ? AND is_played = 0";
        } else {
            $query = "DELETE FROM bag_contents WHERE bag_id = ?";
        }
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("Error preparing clear query: " . $this->conn->error);
            return false;
        }
        
        $stmt->bind_param("i", $bagId);
        $ok = $stmt->execute();
        
        if (!$ok) {
            error_log("Error executing clear query: " . $stmt->error);
            $stmt->close();
            return false;
        }
        
        $affectedRows = $stmt->affected_rows;
        $stmt->close();
        
        error_log("clearBagContents: Eliminados $affectedRows bag_contents de bag_id $bagId");
        
        return $ok;
    }

    /**
     * Llenar las bolsas de un juego con especies aleatorias.
     * Algunas especies pueden repetirse.
     * OPTIMIZADO para evitar timeouts de transacción usando insert masivo
     *
     * @param int $gameId
     * @param int $numPerBag Cantidad de dinos por bolsa
     * @param bool $clearFirst Si true, limpia las bolsas antes de llenarlas (para nuevas rondas)
     * @return bool
     */
    public function fillBagsRandomlyWithSpecies(int $gameId, int $numPerBag = 6, bool $clearFirst = false): bool
    {
        error_log("Starting fillBagsRandomlyWithSpecies for gameId $gameId (clearFirst=$clearFirst)");
        
        // Obtener todas las bolsas de la partida
        $query = "SELECT bag_id FROM bags WHERE game_id = ?";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("Error preparing query to get bags: " . $this->conn->error);
            return false;
        }
        
        $stmt->bind_param("i", $gameId);
        $stmt->execute();
        $result = $stmt->get_result();
        $bagIds = $result ? array_column($result->fetch_all(MYSQLI_ASSOC), 'bag_id') : [];
        $stmt->close();

        if (empty($bagIds)) {
            error_log("No bags found for gameId $gameId");
            return false;
        }
        
        error_log("Found " . count($bagIds) . " bags for game $gameId");

        // Limpiar las bolsas si es necesario (nueva ronda)
        if ($clearFirst) {
            error_log("Clearing ALL bag contents before filling (new round)...");
            foreach ($bagIds as $bagId) {
                // Limpiar TODOS los dinosaurios (incluyendo jugados) para comenzar la nueva ronda
                if (!$this->clearBagContents($bagId, false)) {
                    error_log("Warning: Failed to clear bag $bagId");
                } else {
                    error_log("Successfully cleared bag $bagId");
                }
            }
        }

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
        
        error_log("Found " . count($speciesIds) . " species in database");
        error_log("Filling " . count($bagIds) . " bags with $numPerBag dinosaurs each");

        // Generar combinaciones únicas de especies para cada bolsa
        $bagCombinations = []; // Almacenar las combinaciones por bagId
        $usedCombinations = []; // Almacenar combinaciones ya usadas (normalizadas)
        
        foreach ($bagIds as $bagIndex => $bagId) {
            // RF17: Algoritmo determinístico que garantiza combinaciones únicas desde el inicio
            // Usar bagId y bagIndex como semilla para generar distribución única
            $seed = ($bagId * 137) + ($bagIndex * 97) + ($gameId * 53); // Factores primos grandes para mejor distribución
            $speciesPool = [];
            $speciesCount = count($speciesIds);
            
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
        
        error_log("=== VERIFICACIÓN DE COMBINACIONES ÚNICAS ===");
        $verificationCombinations = [];
        foreach ($bagCombinations as $bagId => $speciesPool) {
            $normalized = array_count_values($speciesPool);
            ksort($normalized);
            $combinationKey = json_encode($normalized);
            
            if (in_array($combinationKey, $verificationCombinations, true)) {
                error_log("⚠️ ADVERTENCIA: Bolsa $bagId tiene una combinación duplicada!");
            } else {
                $verificationCombinations[] = $combinationKey;
                error_log("✅ Bolsa $bagId: Combinación única verificada");
            }
        }
        
        error_log("Total de combinaciones únicas: " . count($verificationCombinations) . " / " . count($bagIds));
        
        // Construir el array de valores para la inserción
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

        $expectedTotal = count($bagIds) * $numPerBag;
        if (count($values) !== $expectedTotal) {
            error_log("ERROR: Se esperaban $expectedTotal dinosaurios, pero se generaron " . count($values));
            return false;
        }
        
        error_log("✅ Verificación PRE-INSERT: " . count($values) . " dinosaurios (correcto)");

        // Insertar todos los datos en una sola query masiva
        $valuesString = implode(', ', $values);
        $insertQuery = "INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES $valuesString";
        
        error_log("Executing massive insert for " . count($values) . " dinosaurs with balanced distribution");
        
        $result = $this->conn->query($insertQuery);
        if (!$result) {
            error_log("Failed to insert dinosaurs: " . $this->conn->error);
            return false;
        }

        // VERIFICAR POST-INSERT: Contar cuántos se insertaron realmente
        $totalInserted = 0;
        foreach ($bagIds as $bagId) {
            $countQuery = "SELECT COUNT(*) as total FROM bag_contents WHERE bag_id = ? AND is_played = 0";
            $countStmt = $this->conn->prepare($countQuery);
            $countStmt->bind_param("i", $bagId);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $countRow = $countResult->fetch_assoc();
            $count = $countRow['total'];
            $totalInserted += $count;
            error_log("fillBags POST-INSERT: Bolsa $bagId tiene $count dinosaurios no jugados");
            $countResult->free();
            $countStmt->close();
            
            // VALIDACIÓN ESTRICTA
            if ($count !== $numPerBag) {
                error_log("ERROR CRÍTICO: Bolsa $bagId debería tener $numPerBag dinosaurios, tiene $count");
                return false;
            }
        }

        error_log("✅ All bags filled successfully: $totalInserted dinosaurios totales (esperados: $expectedTotal)");
        
        if ($totalInserted !== $expectedTotal) {
            error_log("ERROR: Total insertado ($totalInserted) no coincide con esperado ($expectedTotal)");
            return false;
        }
        
        return true;
    }

    /**
     * NUEVO: Mezcla completamente todos los dinosaurios no jugados entre todas las bolsas
     * Garantiza máxima variedad en cada turno
     * @param int $gameId ID del juego
     * @return bool true si se mezcló exitosamente
     */
    public function shuffleAllBags(int $gameId): bool
    {
        error_log("shuffleAllBags: Iniciando mezcla completa para juego $gameId");
        
        // 1. Obtener todas las bolsas del juego
        $getBagsSql = "SELECT bag_id, user_id FROM bags WHERE game_id = ? ORDER BY bag_id ASC";
        $stmt = $this->conn->prepare($getBagsSql);
        if (!$stmt) {
            $this->lastError = "Error preparando consulta para obtener bolsas: " . $this->conn->error;
            error_log($this->lastError);
            return false;
        }

        $stmt->bind_param("i", $gameId);
        if (!$stmt->execute()) {
            $this->lastError = "Error ejecutando consulta para obtener bolsas: " . $stmt->error;
            error_log($this->lastError);
            $stmt->close();
            return false;
        }

        $result = $stmt->get_result();
        $bags = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        if ($result) $result->free();
        $stmt->close();

        if (count($bags) < 2) {
            $this->lastError = "No hay suficientes bolsas para mezclar";
            error_log($this->lastError);
            return false;
        }

        error_log("shuffleAllBags: Encontradas " . count($bags) . " bolsas");

        // 2. Obtener TODOS los dinosaurios no jugados de TODAS las bolsas
        $bagIds = array_column($bags, 'bag_id');
        $placeholders = implode(',', array_fill(0, count($bagIds), '?'));
        
        $getDinosSql = "SELECT bag_content_id, bag_id, species_id 
                        FROM bag_contents 
                        WHERE bag_id IN ($placeholders) AND is_played = 0
                        ORDER BY bag_content_id";
        
        $stmt = $this->conn->prepare($getDinosSql);
        if (!$stmt) {
            $this->lastError = "Error preparando consulta de dinosaurios: " . $this->conn->error;
            error_log($this->lastError);
            return false;
        }

        $types = str_repeat('i', count($bagIds));
        $stmt->bind_param($types, ...$bagIds);
        
        if (!$stmt->execute()) {
            $this->lastError = "Error obteniendo dinosaurios: " . $stmt->error;
            error_log($this->lastError);
            $stmt->close();
            return false;
        }

        $result = $stmt->get_result();
        $allDinos = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        if ($result) $result->free();
        $stmt->close();

        if (empty($allDinos)) {
            error_log("shuffleAllBags: No hay dinosaurios para mezclar");
            return true; // No es un error, simplemente no hay nada que mezclar
        }

        error_log("shuffleAllBags: Encontrados " . count($allDinos) . " dinosaurios no jugados");

        // 3. Mezclar aleatoriamente los dinosaurios
        shuffle($allDinos);
        error_log("shuffleAllBags: Dinosaurios mezclados aleatoriamente");

        // 4. Redistribuir los dinosaurios entre las bolsas de forma equitativa
        $this->conn->begin_transaction();
        try {
            $dinosPerBag = floor(count($allDinos) / count($bags));
            $remainder = count($allDinos) % count($bags);
            
            error_log("shuffleAllBags: Distribuyendo $dinosPerBag dinosaurios por bolsa (+ " . $remainder . " extras)");

            $dinoIndex = 0;
            foreach ($bags as $bagIdx => $bag) {
                $bagId = $bag['bag_id'];
                $numDinosForThisBag = $dinosPerBag + ($bagIdx < $remainder ? 1 : 0);
                
                // Actualizar los dinosaurios asignados a esta bolsa
                for ($i = 0; $i < $numDinosForThisBag && $dinoIndex < count($allDinos); $i++) {
                    $dino = $allDinos[$dinoIndex];
                    $dinoId = $dino['bag_content_id'];
                    
                    // Solo actualizar si cambió de bolsa
                    if ($dino['bag_id'] != $bagId) {
                        $updateSql = "UPDATE bag_contents SET bag_id = ? WHERE bag_content_id = ?";
                        $updateStmt = $this->conn->prepare($updateSql);
                        if (!$updateStmt) throw new Exception($this->conn->error);
                        
                        $updateStmt->bind_param("ii", $bagId, $dinoId);
                        if (!$updateStmt->execute()) throw new Exception($updateStmt->error);
                        $updateStmt->close();
                    }
                    
                    $dinoIndex++;
                }
                
                error_log("shuffleAllBags: Bolsa $bagId recibió $numDinosForThisBag dinosaurios");
            }

            $this->conn->commit();
            error_log("shuffleAllBags: ✅ Mezcla completa exitosa - cada jugador tiene una mano totalmente nueva");
            return true;
        } catch (Exception $e) {
            $this->conn->rollback();
            $this->lastError = "Error mezclando bolsas: " . $e->getMessage();
            error_log($this->lastError);
            return false;
        }
    }

    /**
     * Obtiene todas las bolsas de un juego
     * @param int $gameId ID del juego
     * @return array Array de bolsas con bag_id y user_id
     */
    public function getBagsForGame(int $gameId): array
    {
        $getBagsSql = "SELECT bag_id, user_id FROM bags WHERE game_id = ? ORDER BY bag_id ASC";
        $stmt = $this->conn->prepare($getBagsSql);
        if (!$stmt) {
            error_log("Error preparando consulta para obtener bolsas: " . $this->conn->error);
            return [];
        }

        $stmt->bind_param("i", $gameId);
        if (!$stmt->execute()) {
            error_log("Error ejecutando consulta para obtener bolsas: " . $stmt->error);
            $stmt->close();
            return [];
        }

        $result = $stmt->get_result();
        $bags = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
        if ($result) $result->free();
        $stmt->close();
        
        return $bags;
    }

    /**
     * Transfiere un dinosaurio de una bolsa a otra
     * @param int $bagContentId ID del contenido de la bolsa (dinosaurio)
     * @param int $toBagId ID de la bolsa de destino
     * @return bool true si se transfirió exitosamente
     */
    public function transferDinoToBag(int $bagContentId, int $toBagId): bool
    {
        $query = "UPDATE bag_contents SET bag_id = ? WHERE bag_content_id = ? AND is_played = 0";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("Error preparando consulta para transferir dinosaurio: " . $this->conn->error);
            return false;
        }

        $stmt->bind_param("ii", $toBagId, $bagContentId);
        $ok = $stmt->execute();
        
        if (!$ok) {
            error_log("Error transfiriendo dinosaurio $bagContentId a bolsa $toBagId: " . $stmt->error);
        } else {
            $affected = $stmt->affected_rows;
            if ($affected === 0) {
                error_log("WARNING: No se pudo transferir dinosaurio $bagContentId (puede que ya esté jugado o no exista)");
            }
        }
        
        $stmt->close();
        return $ok && $stmt->affected_rows > 0;
    }

    /**
     * Rota las bolsas de manera circular (P0->P1->P2->P3->P4->P0)
     * Cada jugador pasa su bolsa al siguiente jugador en orden
     * MEJORADO: Verifica y registra cantidades para garantizar consistencia
     */
    public function swapBags(int $gameId): bool
    {
        error_log("=== SWAP BAGS START for game $gameId ===");
        
        // Obtener TODAS las bolsas del juego ordenadas por bag_id
        $bags = $this->getBagsForGame($gameId);
        
        if (empty($bags)) {
            error_log("No se encontraron bolsas para el juego $gameId");
            return false;
        }

        if (count($bags) < 2) {
            $this->lastError = "No hay suficientes bolsas para rotar (necesitas al menos 2 jugadores)";
            error_log($this->lastError);
            return false;
        }

        // VERIFICAR cantidades ANTES de rotar
        error_log("ANTES de rotar - Verificando cantidades:");
        foreach ($bags as $idx => $bag) {
            $countQuery = "SELECT COUNT(*) as total FROM bag_contents WHERE bag_id = ? AND is_played = 0";
            $countStmt = $this->conn->prepare($countQuery);
            $countStmt->bind_param("i", $bag['bag_id']);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $countRow = $countResult->fetch_assoc();
            $count = $countRow['total'];
            error_log("  Bolsa {$bag['bag_id']} (user {$bag['user_id']}): $count dinosaurios no jugados");
            $countResult->free();
            $countStmt->close();
        }

        error_log("Rotando bolsas: " . count($bags) . " jugadores en juego $gameId");

        // Iniciar transacción
        $this->conn->begin_transaction();
        try {
            // Algoritmo de rotación circular:
            // 1. Guardar el user_id de la última bolsa
            // 2. Rotar cada bolsa para que tome el user_id de la anterior
            
            $lastUserId = $bags[count($bags) - 1]['user_id']; // user_id del último jugador
            
            // Rotación circular: cada jugador pasa su bolsa al siguiente
            for ($i = count($bags) - 1; $i > 0; $i--) {
                $currentBagId = $bags[$i]['bag_id'];
                $previousUserId = $bags[$i - 1]['user_id'];
                
                $sql = "UPDATE bags SET user_id = ? WHERE bag_id = ?";
                $stmt = $this->conn->prepare($sql);
                if (!$stmt) throw new Exception($this->conn->error);
                $stmt->bind_param("ii", $previousUserId, $currentBagId);
                if (!$stmt->execute()) throw new Exception($stmt->error);
                $stmt->close();
                
                error_log("  Bolsa $currentBagId ahora pertenece a user_id {$previousUserId}");
            }
            
            // La primera bolsa toma el user_id del último jugador
            $firstBagId = $bags[0]['bag_id'];
            $sql = "UPDATE bags SET user_id = ? WHERE bag_id = ?";
            $stmt = $this->conn->prepare($sql);
            if (!$stmt) throw new Exception($this->conn->error);
            $stmt->bind_param("ii", $lastUserId, $firstBagId);
            if (!$stmt->execute()) throw new Exception($stmt->error);
            $stmt->close();
            
            error_log("  Bolsa $firstBagId ahora pertenece a user_id {$lastUserId}");

            $this->conn->commit();
            
            // VERIFICAR cantidades DESPUÉS de rotar
            error_log("DESPUÉS de rotar - Verificando cantidades:");
            foreach ($bags as $idx => $bag) {
                $countQuery = "SELECT COUNT(*) as total FROM bag_contents WHERE bag_id = ? AND is_played = 0";
                $countStmt = $this->conn->prepare($countQuery);
                $countStmt->bind_param("i", $bag['bag_id']);
                $countStmt->execute();
                $countResult = $countStmt->get_result();
                $countRow = $countResult->fetch_assoc();
                $count = $countRow['total'];
                error_log("  Bolsa {$bag['bag_id']} (ahora con nuevo user): $count dinosaurios no jugados");
                $countResult->free();
                $countStmt->close();
            }
            
            error_log("=== SWAP BAGS SUCCESS ===");
            return true;
        } catch (Exception $e) {
            $this->conn->rollback();
            $this->lastError = "Error rotando bolsas: " . $e->getMessage();
            error_log($this->lastError);
            error_log("=== SWAP BAGS FAILED ===");
            return false;
        }
    }

    /**
     * DIAGNÓSTICO: Verifica y reporta el estado de todas las bolsas de un juego
     * @param int $gameId ID del juego
     * @return array Estado de todas las bolsas
     */
    public function diagnoseBagState(int $gameId): array {
        error_log("=== DIAGNÓSTICO DE BOLSAS - Game $gameId ===");
        
        // Obtener todas las bolsas
        $bagQuery = "SELECT bag_id, user_id FROM bags WHERE game_id = ? ORDER BY bag_id ASC";
        $stmt = $this->conn->prepare($bagQuery);
        $stmt->bind_param("i", $gameId);
        $stmt->execute();
        $result = $stmt->get_result();
        $bags = $result->fetch_all(MYSQLI_ASSOC);
        $result->free();
        $stmt->close();
        
        $diagnosis = [];
        foreach ($bags as $bag) {
            $bagId = $bag['bag_id'];
            $userId = $bag['user_id'];
            
            // Contar dinosaurios no jugados
            $countQuery = "SELECT COUNT(*) as total FROM bag_contents WHERE bag_id = ? AND is_played = 0";
            $countStmt = $this->conn->prepare($countQuery);
            $countStmt->bind_param("i", $bagId);
            $countStmt->execute();
            $countResult = $countStmt->get_result();
            $countRow = $countResult->fetch_assoc();
            $unplayedCount = $countRow['total'];
            $countResult->free();
            $countStmt->close();
            
            // Contar dinosaurios jugados
            $playedQuery = "SELECT COUNT(*) as total FROM bag_contents WHERE bag_id = ? AND is_played = 1";
            $playedStmt = $this->conn->prepare($playedQuery);
            $playedStmt->bind_param("i", $bagId);
            $playedStmt->execute();
            $playedResult = $playedStmt->get_result();
            $playedRow = $playedResult->fetch_assoc();
            $playedCount = $playedRow['total'];
            $playedResult->free();
            $playedStmt->close();
            
            $total = $unplayedCount + $playedCount;
            
            $diagnosis[] = [
                'bag_id' => $bagId,
                'user_id' => $userId,
                'unplayed' => $unplayedCount,
                'played' => $playedCount,
                'total' => $total
            ];
            
            error_log("  Bolsa $bagId (user $userId): $unplayedCount no jugados + $playedCount jugados = $total total");
        }
        
        error_log("=== FIN DIAGNÓSTICO ===");
        return $diagnosis;
    }

    /**
     * Verifica si un dinosaurio pertenece a la bolsa del jugador
     * @param int $bagContentId ID del contenido de la bolsa
     * @param int $gameId ID del juego
     * @param int $playerSeat Asiento del jugador (0-4)
     * @return bool true si el dinosaurio está en la bolsa del jugador
     */
    public function isDinoInPlayerBag(int $bagContentId, int $gameId, int $playerSeat): bool {
        // MEJORADO: Verificar que el dinosaurio existe y está disponible (no jugado)
        // La query ahora es más permisiva para trabajar con el intercambio de bolsas
        
        // Primero verificar que el dinosaurio existe y no está jugado
        $checkQuery = "SELECT COUNT(*) as count 
                       FROM bag_contents bc
                       JOIN bags b ON bc.bag_id = b.bag_id
                       WHERE bc.bag_content_id = ? 
                       AND b.game_id = ?
                       AND bc.is_played = 0";
        
        $stmt = $this->conn->prepare($checkQuery);
        if (!$stmt) {
            error_log("Error preparando la consulta isDinoInPlayerBag (check): " . $this->conn->error);
            return false;
        }
        
        $stmt->bind_param("ii", $bagContentId, $gameId);
        
        if (!$stmt->execute()) {
            error_log("Error ejecutando la consulta isDinoInPlayerBag (check): " . $stmt->error);
            $stmt->close();
            return false;
        }
        
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $exists = $row && $row['count'] > 0;
        
        if ($result) $result->free();
        $stmt->close();
        
        if (!$exists) {
            error_log("isDinoInPlayerBag: Dino $bagContentId no existe o ya está jugado en juego $gameId");
            return false;
        }
        
        // Ahora verificar que pertenece al jugador correcto (soporta hasta 5 jugadores)
        $query = "SELECT COUNT(*) as count 
                  FROM bag_contents bc
                  JOIN bags b ON bc.bag_id = b.bag_id
                  JOIN games g ON b.game_id = g.game_id
                  WHERE bc.bag_content_id = ? 
                  AND g.game_id = ?
                  AND ((g.player1_user_id = b.user_id AND ? = 0) 
                       OR (g.player2_user_id = b.user_id AND ? = 1)
                       OR (g.player3_user_id = b.user_id AND ? = 2)
                       OR (g.player4_user_id = b.user_id AND ? = 3)
                       OR (g.player5_user_id = b.user_id AND ? = 4))
                  AND bc.is_played = 0";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            error_log("Error preparando la consulta isDinoInPlayerBag: " . $this->conn->error);
            return false;
        }

        // Bind 7 parámetros: bagContentId, gameId, y 5 veces playerSeat
        $stmt->bind_param("iiiiiii", $bagContentId, $gameId, $playerSeat, $playerSeat, $playerSeat, $playerSeat, $playerSeat);
        
        if (!$stmt->execute()) {
            error_log("Error ejecutando la consulta isDinoInPlayerBag: " . $stmt->error);
            $stmt->close();
            return false;
        }

        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $count = $row ? $row['count'] : 0;

        if ($result) $result->free();
        $stmt->close();
        
        $belongs = $count > 0;
        error_log("isDinoInPlayerBag: Dino $bagContentId en juego $gameId para jugador $playerSeat - Resultado: " . ($belongs ? "SÍ" : "NO"));

        return $belongs;
    }
    
    /**
     * Verifica si es el primer turno del juego
     * @param int $gameId ID del juego
     * @return bool true si es el primer turno
     */
    public function isFirstTurn(int $gameId): bool {
        // Verificar si hay alguna tirada de dado registrada
        $query = "SELECT COUNT(*) as count FROM placement_die_rolls WHERE game_id = ?";
        $stmt = $this->conn->prepare($query);
        
        if (!$stmt) return true; // En caso de error, asumimos primer turno para ser permisivos
        
        $stmt->bind_param("i", $gameId);
        $stmt->execute();
        
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $hasDieRolls = $row && $row['count'] > 0;
        
        if ($result) $result->free();
        $stmt->close();
        
        // Verificar si hay colocaciones registradas
        $query = "SELECT COUNT(*) as count FROM placement WHERE game_id = ?";
        $stmt = $this->conn->prepare($query);
        
        if (!$stmt) return true; // En caso de error, asumimos primer turno para ser permisivos
        
        $stmt->bind_param("i", $gameId);
        $stmt->execute();
        
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $hasPlacements = $row && $row['count'] > 0;
        
        if ($result) $result->free();
        $stmt->close();
        
        // Es primer turno si no hay tiradas ni colocaciones
        return !$hasDieRolls && !$hasPlacements;
    }

    /**
     * Obtiene los dinosaurios no jugados en la bolsa de un jugador
     * @param int $gameId ID del juego
     * @param int $playerSeat Asiento del jugador (0 o 1)
     * @return array Dinosaurios disponibles en la bolsa
     */
    public function getDinosInBag(int $gameId, int $playerSeat): array {
        try {
            // Primero verificamos que el juego existe
            $gameCheck = "SELECT game_id FROM games WHERE game_id = ?";
            $gameStmt = $this->conn->prepare($gameCheck);
            
            if (!$gameStmt) {
                error_log("BagRepository::getDinosInBag - Error preparando consulta para verificar juego: " . $this->conn->error);
                return [];
            }
            
            $gameStmt->bind_param("i", $gameId);
            $gameStmt->execute();
            $gameResult = $gameStmt->get_result();
            
            if (!$gameResult || $gameResult->num_rows === 0) {
                return [];
            }
            
            if ($gameResult) $gameResult->free();
            $gameStmt->close();
            
            // Nueva query que soporta hasta 5 jugadores
            $query = "SELECT bc.bag_content_id as dino_id, bc.species_id, s.name, s.img, s.code as dino_color
                 FROM bag_contents bc
                 JOIN bags b ON bc.bag_id = b.bag_id
                 JOIN species s ON bc.species_id = s.species_id
                 JOIN games g ON b.game_id = g.game_id
                 WHERE g.game_id = ? 
                 AND ((g.player1_user_id = b.user_id AND ? = 0) 
                      OR (g.player2_user_id = b.user_id AND ? = 1)
                      OR (g.player3_user_id = b.user_id AND ? = 2)
                      OR (g.player4_user_id = b.user_id AND ? = 3)
                      OR (g.player5_user_id = b.user_id AND ? = 4))
                 AND bc.is_played = 0";

            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                error_log("BagRepository::getDinosInBag - Error preparando consulta principal: " . $this->conn->error);
                return [];
            }

            // Bind parameters: gameId + 5 veces playerSeat para todas las condiciones
            $stmt->bind_param("iiiiii", $gameId, $playerSeat, $playerSeat, $playerSeat, $playerSeat, $playerSeat);
            
            if (!$stmt->execute()) {
                error_log("BagRepository::getDinosInBag - Error ejecutando consulta: " . $stmt->error);
                $stmt->close();
                return [];
            }

            $result = $stmt->get_result();
            $dinos = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
            
            error_log("BagRepository::getDinosInBag - Recuperados " . count($dinos) . " dinosaurios para jugador $playerSeat en juego $gameId");

            if ($result) $result->free();
            $stmt->close();

            return $dinos;
            
        } catch (Exception $e) {
            error_log("Error en BagRepository::getDinosInBag: " . $e->getMessage());
            return [];
        }
    }
}

?>