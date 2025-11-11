<?php

require_once __DIR__ . '/../repositories/GameRepository.php';
require_once __DIR__ . '/../repositories/BagRepository.php';
require_once __DIR__ . '/../repositories/PlacementDieRollRepository.php';
require_once __DIR__ . '/../repositories/PlacementRepository.php';
require_once __DIR__ . '/../repositories/FinalScoreRepository.php';
require_once __DIR__ . '/../repositories/RoomRepository.php';

class GamePlayService
{
    // Game rules moved to Config class

    private GameRepository $gameRepo;
    private BagRepository $bagRepo;
    private PlacementDieRollRepository $dieRepo;
    private PlacementRepository $placementRepo;
    private FinalScoreRepository $scoreRepo;
    private RoomRepository $roomRepo;
    private array $gameRules;

    private int $gameId;
    private int $playerSeat;

    public function __construct()
    {
        $this->gameRepo = GameRepository::getInstance();
        $this->bagRepo = BagRepository::getInstance();
        $this->dieRepo = PlacementDieRollRepository::getInstance();
        $this->placementRepo = PlacementRepository::getInstance();
        $this->scoreRepo = FinalScoreRepository::getInstance();
        $this->roomRepo = RoomRepository::getInstance();
        $this->gameRules = [
            'MAX_PLAYERS' => 5,
            'DINOS_PER_PLAYER' => 6,
            'MAX_ROUNDS' => 2,
            // TURNS_PER_ROUND se calcula dinámicamente: totalPlayers * 6
            // 2 jugadores = 12 turnos, 3 = 18, 4 = 24, 5 = 30
            'TURN_TIME_LIMIT' => 60,
            'ENCLOSURE_TYPES' => [
                'FOREST' => 'forest',
                'ROCK' => 'rock',
                'MIXED' => 'mixed'
            ],
            'ENCLOSURE_POSITIONS' => [
                'LEFT' => 'left',
                'RIGHT' => 'right',
                'CENTER' => 'center'
            ],
            'SPECIAL_RULES' => [
                'SAME_SPECIES' => 'SAME_SPECIES',
                'DIFFERENT_SPECIES' => 'DIFFERENT_SPECIES',
                'PAIRS_BONUS' => 'PAIRS_BONUS',
                'TRIO_REQUIRED' => 'TRIO_REQUIRED',
                'MAJORITY_SPECIES' => 'MAJORITY_SPECIES'
            ],
            'DIE_FACES' => [
                'LEFT_SIDE',
                'RIGHT_SIDE',
                'FOREST',
                'EMPTY',
                'NO_TREX',
                'ROCKS'
            ]
        ];
    }

    // -----------------------------
    // Flujo de juego
    // -----------------------------

    /**
     * Obtiene las partidas pendientes para un usuario
     * @param int $userId ID del usuario
     * @return array Lista de partidas pendientes
     */
    public function getPendingGames(int $userId): array {
        // Obtener todas las partidas en progreso del usuario
        $inProgressGames = $this->gameRepo->getInProgressGamesByUser($userId);
        $pendingGames = [];
        
        foreach ($inProgressGames as $game) {
            // Determinar si es turno del usuario
            $isMyTurn = $game['active_seat'] == ($game['player1_user_id'] == $userId ? 0 : 1);
            
            // Determinar nombre del oponente
            $opponentId = $game['player1_user_id'] == $userId ? $game['player2_user_id'] : $game['player1_user_id'];
            $opponent = $this->gameRepo->getUserById($opponentId);
            $opponentUsername = $opponent ? $opponent['username'] : 'Oponente';
            
            // Añadir a la lista de partidas pendientes
            $pendingGames[] = [
                'game_id' => $game['game_id'],
                'opponent_username' => $opponentUsername,
                'created_at' => $game['created_at'],
                'is_my_turn' => $isMyTurn
            ];
        }
        
        return $pendingGames;
    }
    /**
     * Inicia una nueva partida
     * @param int $player1Id ID del primer jugador
     * @param int $player2Id ID del segundo jugador
     * @return int ID de la partida creada
     */
    public function startGame(int $player1Id, int $player2Id): int {
        // Debug info
        error_log("Starting game with players: $player1Id and $player2Id");
        
        // Crear juego y asignar jugadores
        $gameId = $this->gameRepo->createGame($player1Id, $player2Id);
        if (!$gameId) {
            error_log("Failed to create game in database");
            throw new Exception("No se pudo crear la partida en la base de datos");
        }
        
        error_log("Game created with ID: $gameId");
        
        try {
            // Crear y llenar bolsas para ambos jugadores
            $this->bagRepo->createBagsForGame($gameId, [$player1Id, $player2Id]);
            error_log("Bags created for game $gameId");
            
            // REGLA ESTRICTA: 6 dinosaurios por jugador al inicio de cada ronda
            $this->bagRepo->fillBagsRandomlyWithSpecies($gameId, 6);
            error_log("Bags filled with dinosaurs");
            
            // VERIFICAR que cada jugador tiene exactamente 6 dinosaurios
            $this->bagRepo->diagnoseBagState($gameId);
            for ($i = 0; $i < 2; $i++) {
                $count = count($this->bagRepo->getDinosInBag($gameId, $i));
                error_log("startGame: Jugador $i tiene $count dinosaurios");
                if ($count !== 6) {
                    error_log("ERROR CRÍTICO: Jugador $i debería tener 6 dinosaurios, tiene $count");
                    throw new Exception("Error en generación de bolsas: cantidad incorrecta");
                }
            }
            error_log("✅ startGame: Todos los jugadores tienen exactamente 6 dinosaurios");
        } catch (Exception $e) {
            error_log("Error in startGame: " . $e->getMessage());
            throw $e;
        }
        
        return $gameId;
    }

    /**
     * Lanza el dado y guarda la restricción para el siguiente jugador
     * @param int $gameId ID del juego
     * @param int $rollerSeat Asiento del jugador que lanza (jugador activo)
     * @param int $affectedSeat Asiento del jugador afectado por la restricción
     * @param string $dieFace Cara del dado obtenida
     * @return int|null ID del registro de la tirada o null si falla
     */
    public function rollDie(int $gameId, int $rollerSeat, int $affectedSeat, string $dieFace): ?int {
        // Verificar que sea el jugador activo quien lanza
        $game = $this->gameRepo->getGameById($gameId);
        if (!$game) {
            error_log("rollDie: Game $gameId not found");
            return null;
        }
        
        if (!$this->isActivePlayer($game, $rollerSeat)) {
            error_log("rollDie: Player $rollerSeat is not the active player. Active seat: " . ($game['active_seat'] ?? 'not set'));
            return null;
        }

        // Guardar la tirada del dado
        return $this->dieRepo->insertDieRoll($gameId, $affectedSeat, $dieFace);
    }

    public function placeDino(int $gameId, int $playerSeat, int $bagContentId, int $enclosureId, ?int $slotIndex = null): bool
    {
        error_log("========================================");
        error_log("placeDino: Iniciando colocación");
        error_log("  GameID: $gameId");
        error_log("  PlayerSeat: $playerSeat");
        error_log("  DinoID: $bagContentId");
        error_log("  EnclosureID: $enclosureId");
        error_log("  SlotIndex: " . ($slotIndex !== null ? $slotIndex : 'null'));
        
        try {
            // Validar que el dino no esté jugado
            if ($this->bagRepo->isDinoPlayed($bagContentId)) {
                error_log("placeDino: ⚠️ El dinosaurio $bagContentId ya está jugado");
            }
                        
            // Insertar colocación
            $placementId = $this->placementRepo->insertPlacement($gameId, $playerSeat, $bagContentId, $enclosureId, $slotIndex);
            
            if ($placementId === null) {
                error_log("placeDino: ❌ Error al insertar colocación. El método insertPlacement retornó null");
                error_log("========================================");
                return false;
            }
            
            error_log("placeDino: ✅ Placement insertado con ID=$placementId");
                        
            $this->bagRepo->markDinoPlayed($bagContentId);
            error_log("placeDino: ✅ Dinosaurio $bagContentId marcado como jugado");
            
            // NOTA: No guardamos el puntaje aquí, solo se guarda al final de cada ronda
            // El puntaje se calcula en tiempo real en getCurrentScores() sumando:
            // - Puntaje acumulado de rondas anteriores (guardado en final_score)
            // - Puntaje de la ronda actual (calculado desde placements)
            error_log("placeDino: ✅ Colocación completada (puntajes se calculan en tiempo real)");
            error_log("========================================");
            
            return true;
        } catch (Exception $e) {
            error_log("placeDino: ❌ ERROR: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            error_log("========================================");
            throw $e;
        }
    }

    public function getValidEnclosuresForPlayer(int $gameId, int $playerSeat): array
    {
        // Jugador activo nunca tiene restricción de dado
        return $this->placementRepo->getAllEnclosures($gameId);
    }

    /**
     * Valida las restricciones del dado de colocación
     * RF13: El jugador que tira el dado NO se ve afectado por las restricciones
     * Todos los demás jugadores DEBEN respetar la restricción del dado
     * 
     * @param int $gameId ID de la partida
     * @param int $playerSeat Asiento del jugador que intenta colocar
     * @param int $enclosureId ID del recinto
     * @return bool true si cumple la restricción, false si no
     */
    public function validateDieRestriction(int $gameId, int $playerSeat, int $enclosureId): bool {
        // El río (recinto 7) SIEMPRE es válido independientemente del dado (RNF48)
        if ($enclosureId === 7) {
            return true;
        }
        
        // Obtener la última tirada del dado
        $lastRoll = $this->dieRepo->getLastGameRoll($gameId);
        
        // Si no hay tirada previa, no hay restricción
        if (!$lastRoll) {
            return true;
        }
        
        // CAMBIO: El jugador que tiró el dado TAMBIÉN debe cumplir la restricción
        // Todos los jugadores, incluyendo el que tiró el dado, deben respetar la restricción
        $dieFace = $lastRoll['die_face'];
        
        error_log("validateDieRestriction: Aplicando restricción del dado a jugador $playerSeat - die_face=$dieFace");
        
        // Obtener información del recinto
        $enclosure = $this->placementRepo->getEnclosure($enclosureId);
        if (!$enclosure) {
            error_log("validateDieRestriction: Enclosure $enclosureId not found");
            return false;
        }
        
        // $dieFace ya está asignado arriba (del último dado o del anterior según el caso)
        $enclosurePosition = $enclosure['position'] ?? '';
        $enclosureTerrain = $enclosure['terrain'] ?? '';
        
        error_log("validateDieRestriction: die_face=$dieFace, enclosure=$enclosureId, position=$enclosurePosition, terrain=$enclosureTerrain");
        
        // Mapeo de recintos a áreas según el EsRe y el HTML del frontend
        // Recinto 1: Bosque de Semejanza - position='left', terrain='forest' → área=bosque, lado=izquierda (Cafeterías)
        // Recinto 2: Parado Diferencia - position='left', terrain='rock' → área=bosque, lado=izquierda (Cafeterías)
        // Recinto 3: Pradera del Amor - position='right', terrain='mixed' → área=llanura, lado=derecha (Baños)
        // Recinto 4: Trio Frondoso - position='center', terrain='forest' → área=llanura, lado=izquierda
        // Recinto 5: Rey de la Selva - position='right', terrain='forest' → área=llanura, lado=derecha (Baños)
        // Recinto 6: Isla Solitaria - position='center', terrain='rock' → área=llanura, lado=derecha
        // Recinto 7: Río - siempre válido (ya manejado arriba)
        
        // Mapeo de recintos a áreas (bosque/llanura) según el frontend
        $enclosureAreaMapping = [
            1 => 'bosque',  // Bosque de Semejanza
            2 => 'bosque',  // Parado Diferencia
            3 => 'llanura', // Pradera del Amor
            4 => 'llanura', // Trio Frondoso
            5 => 'llanura', // Rey de la Selva
            6 => 'llanura', // Isla Solitaria
            7 => 'rio'      // Río (ya manejado)
        ];
        
        // Mapeo de recintos a lados (izquierda/derecha) según el frontend
        $enclosureSideMapping = [
            1 => 'derecha',   // Bosque de Semejanza
            2 => 'izquierda', // Parado Diferencia
            3 => 'izquierda', // Pradera del Amor
            4 => 'izquierda', // Trio Frondoso
            5 => 'centro',    // Rey de la Selva
            6 => 'derecha',   // Isla Solitaria
            7 => 'centro'     // Río (ya manejado)
        ];
        
        $enclosureArea = $enclosureAreaMapping[$enclosureId] ?? 'unknown';
        $enclosureSide = $enclosureSideMapping[$enclosureId] ?? 'unknown';
        
        // Validar según la cara del dado
        switch ($dieFace) {
            case 'LEFT_SIDE':
                // RF37: Cafeterías - lado izquierdo
                // Según el HTML: Recintos 2, 3, 4 tienen data-side="izquierda"
                $validSides = ['izquierda'];
                $isValid = in_array($enclosureSide, $validSides);
                error_log("validateDieRestriction: LEFT_SIDE (Cafeterías) - recinto $enclosureId lado=$enclosureSide, válido=" . ($isValid ? 'SÍ' : 'NO'));
                return $isValid;
                
            case 'RIGHT_SIDE':
                // RF36: Baños - lado derecho
                // Según el HTML: Recintos 1, 6 tienen data-side="derecha"
                // NOTA: El recinto 3 (Pradera del Amor) tiene position='right' en BD pero data-side="izquierda" en HTML
                // Usamos el mapeo del HTML porque es lo que el frontend valida
                $validSides = ['derecha'];
                $isValid = in_array($enclosureSide, $validSides);
                error_log("validateDieRestriction: RIGHT_SIDE (Baños) - recinto $enclosureId lado=$enclosureSide, válido=" . ($isValid ? 'SÍ' : 'NO'));
                return $isValid;
                
            case 'FOREST':
                // RF34: Árboles Comunes - área bosque
                // Recintos 1, 2 están en el área bosque
                $validAreas = ['bosque'];
                $isValid = in_array($enclosureArea, $validAreas);
                error_log("validateDieRestriction: FOREST (Árboles Comunes) - recinto $enclosureId área=$enclosureArea, válido=" . ($isValid ? 'SÍ' : 'NO'));
                return $isValid;
                
            case 'ROCKS':
                // RF35: Manzanos - área llanura
                // Recintos 3, 4, 5, 6 están en el área llanura
                $validAreas = ['llanura'];
                $isValid = in_array($enclosureArea, $validAreas);
                error_log("validateDieRestriction: ROCKS (Manzanos) - recinto $enclosureId área=$enclosureArea, válido=" . ($isValid ? 'SÍ' : 'NO'));
                return $isValid;
                
            case 'EMPTY':
                // RF38: Recinto Vacío - debe estar vacío (sin dinosaurios) para el jugador actual
                // Cada jugador tiene su propio tablero, por lo que verificamos solo para el jugador actual
                $hasPlacements = $this->placementRepo->hasPlacementsInEnclosureForPlayer($gameId, $playerSeat, $enclosureId);
                $isEmpty = !$hasPlacements;
                error_log("validateDieRestriction: EMPTY (Recinto Vacío) - recinto $enclosureId para jugador $playerSeat vacío=" . ($isEmpty ? 'SÍ' : 'NO'));
                return $isEmpty;
                
            case 'NO_TREX':
                // RF39: Recinto sin T-REX - debe estar sin T-Rex para el jugador actual
                // Cada jugador tiene su propio tablero, por lo que verificamos solo para el jugador actual
                // T-Rex tiene species_id = 2 según el SQL, nombre 'T-Rex Rojo', código 'rojo'
                $hasTrexByName = $this->placementRepo->hasSpeciesInEnclosureForPlayer($gameId, $playerSeat, $enclosureId, 'T-Rex Rojo');
                $hasTrexByCode = $this->placementRepo->hasSpeciesInEnclosureByCodeForPlayer($gameId, $playerSeat, $enclosureId, 'rojo');
                $hasTrex = $hasTrexByName || $hasTrexByCode;
                $isValid = !$hasTrex;
                error_log("validateDieRestriction: NO_TREX - recinto $enclosureId para jugador $playerSeat tieneTrex=" . ($hasTrex ? 'SÍ' : 'NO') . ", válido=" . ($isValid ? 'SÍ' : 'NO'));
                return $isValid;
                
            default:
                error_log("validateDieRestriction: Cara del dado desconocida: $dieFace - permitiendo colocación");
                return true;
        }
    }

    // -----------------------------
    // Calcular puntaje
    // -----------------------------

    /**
     * Calcula la puntuación final de un jugador
     * @param int $gameId ID de la partida
     * @param int $playerSeat Asiento del jugador
     * @return int Puntuación total
     */

    public function calculateScore(int $gameId, int $playerSeat): int
    {
        error_log("========================================");
        error_log("calculateScore: 🔢 Calculando puntaje");
        error_log("  GameID: $gameId");
        error_log("  PlayerSeat: $playerSeat");
        
        // Contexto para cálculos dependientes
        $this->gameId = $gameId;
        $this->playerSeat = $playerSeat;

        $placements = $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat);
        error_log("  Total de colocaciones: " . count($placements));
        
        if (count($placements) === 0) {
            error_log("  No hay colocaciones aún, puntaje = 0");
            error_log("========================================");
            return 0;
        }
        
        $totalPoints = 0;

        // Agrupar placements por recinto
        $enclosurePlacements = [];
        foreach ($placements as $placement) {
            $enclosureId = $placement['enclosures_id'];
            $enclosurePlacements[$enclosureId][] = $placement;
        }

        $enclosureNames = [
            1 => 'Bosque de la Semejanza',
            2 => 'Prado de la Diferencia',
            3 => 'Pradera del Amor',
            4 => 'Trío Frondoso',
            5 => 'Rey de la Selva',
            6 => 'Isla Solitaria',
            7 => 'Río'
        ];

        error_log("  Recintos ocupados: " . count($enclosurePlacements));
        
        // Calcular puntos por cada recinto
        foreach ($enclosurePlacements as $enclosureId => $enclosurePlacements) {
            $enclosureName = $enclosureNames[$enclosureId] ?? "Recinto $enclosureId";
            $dinoCount = count($enclosurePlacements);
            $points = $this->calculatePointsForEnclosure($enclosureId, $enclosurePlacements);
            $totalPoints += $points;
            
            error_log("  ✓ $enclosureName ($dinoCount dinos): +$points pts → Total: $totalPoints pts");
        }

        // Bono: +1 por cada dinosaurio rojo (T-Rex) en cualquier recinto EXCEPTO el río
        $trexCount = 0;
        foreach ($placements as $p) {
            $color = strtolower($p['dino_color'] ?? '');
            $enclosureId = (int)($p['enclosures_id'] ?? 0);
            
            // Solo contar T-Rex que NO están en el río (recinto 7)
            if (($color === 'rojo' || $color === 'red') && $enclosureId !== 7) {
                $totalPoints += 1;
                $trexCount++;
            }
        }
        
        if ($trexCount > 0) {
            error_log("  🦖 Bono T-Rex: +$trexCount pts ($trexCount T-Rex fuera del río) → Total: $totalPoints pts");
        }

        // IMPORTANTE: No guardar puntaje aquí durante el juego
        // Los puntajes se guardan solo al final de cada ronda en startNewRound()
        // O al final del juego en endGame()
        // Esto evita sobrescribir los puntajes acumulados durante el juego
        
        error_log("calculateScore: ✅ RESULTADO = $totalPoints puntos (NO guardado, solo para display)");
        error_log("========================================");

        return $totalPoints;
    }

    /**
     * Obtiene el puntaje acumulado de un jugador (guardado en final_score)
     * Si no existe, retorna 0
     */
    private function getAccumulatedScore(int $gameId, int $playerSeat): int
    {
        $score = $this->scoreRepo->getScore($gameId, $playerSeat);
        return $score ? (int)$score['total_points'] : 0;
    }

    public function finalizeGame(int $gameId): void
    {
        // finalizeGame ahora usa endGame() que maneja correctamente la acumulación de puntajes
        $this->endGame($gameId);
    }

    // -----------------------------
    // Endpoints auxiliares para UI: Bolsa y Recintos
    // -----------------------------

    /**
     * Devuelve la bolsa del jugador formateada para la UI
     */
    public function getPlayerBagForUI(int $gameId, int $playerSeat): array
    {
        $bag = $this->bagRepo->getDinosInBag($gameId, $playerSeat);
        $formatted = [];
        foreach ($bag as $dino) {
            $color = $dino['dino_color'] ?? 'unknown';
            $formatted[] = [
                'id' => (int)($dino['dino_id'] ?? 0),
                'bag_content_id' => (int)($dino['dino_id'] ?? 0),
                'species_id' => (int)($dino['species_id'] ?? 0),
                'dinosaur_type' => $this->mapColorToType($color),
                'orientation' => 'horizontal'
            ];
        }
        return $formatted;
    }

    /**
     * Devuelve el contenido de un recinto específico para un jugador formateado para la UI
     * $enclosureId va de 1..7 (lógico por tablero); para playerSeat=1 se traslada a 8..14 en BD
     */
    public function getEnclosureContentsForUI(int $gameId, int $playerSeat, int $enclosureId): array
    {
        // En nuestra BD, ambos jugadores usan los mismos IDs de recinto (1..7),
        // diferenciados por player_seat. Por lo tanto NO se desplaza el ID.
        $placements = $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat);
        $filtered = array_filter($placements, function ($p) use ($enclosureId) {
            return isset($p['enclosures_id']) && (int)$p['enclosures_id'] === (int)$enclosureId;
        });

        $formatted = [];
        foreach ($filtered as $p) {
            $color = $p['dino_color'] ?? 'unknown';
            $formatted[] = [
                'id' => (int)($p['placement_id'] ?? 0),
                'placement_id' => (int)($p['placement_id'] ?? 0),
                'dino_id' => (int)($p['dino_id'] ?? 0),
                'species_id' => (int)($p['species_id'] ?? 0),
                'dinosaur_type' => $this->mapColorToType($color),
                'slot_index' => isset($p['slot_index']) ? (int)$p['slot_index'] : 0,
                'orientation' => 'vertical'
            ];
        }
        // Ordenar por slot_index por conveniencia
        usort($formatted, function ($a, $b) { return ($a['slot_index'] <=> $b['slot_index']); });
        return $formatted;
    }

    /**
     * Calcula puntos para un recinto específico
     * @param int $enclosureId ID del recinto
     * @param array $placements Colocaciones en el recinto
     * @return int Puntos obtenidos
     */
    private function calculatePointsForEnclosure(int $enclosureId, array $placements): int {
        switch ($enclosureId) {
            case 1: // Bosque de la Semejanza
                return $this->calculateSimilarityForestPoints($placements);
                
            case 2: // Prado de la Diferencia
                return $this->calculateDifferenceMeadowPoints($placements);
                
            case 3: // Pradera del Amor
                return $this->calculateLovePrairiePoints($placements);
                
            case 4: // Trío Frondoso
                return $this->calculateTrioPoints($placements);
                
            case 5: // Rey de la Selva
                if (empty($placements)) return 0;
                return $this->calculateKingOfJunglePoints($placements[0]['species_id'], $this->gameId, $this->playerSeat);
                
            case 6: // Isla Solitaria
                if (empty($placements)) return 0;
                return $this->calculateLonelyIslandPoints($placements[0]['species_id'], $this->gameId, $this->playerSeat);
                
            case 7: // Río
                return count($placements); // 1 punto por dino
                
            default:
                return 0;
        }
    }

    /**
     * Calcula puntos para el Bosque de la Semejanza
     * REGLA: Todos los dinosaurios deben ser de la MISMA especie
     * Puntuación: [2,4,8,12,18,24] según cantidad de dinosaurios
     * @param array $placements Colocaciones en el recinto
     * @return int Puntos obtenidos
     */
    private function calculateSimilarityForestPoints(array $placements): int {
        if (empty($placements)) {
            return 0;
        }
        
        // VALIDACIÓN: Verificar que TODOS sean de la misma especie
        $species = array_map(fn($p) => (int)($p['species_id'] ?? 0), $placements);
        $uniqueSpecies = array_unique($species);
        
        if (count($uniqueSpecies) > 1) {
            error_log("calculateSimilarityForestPoints: ERROR - Especies mixtas detectadas: " . json_encode($uniqueSpecies));
            return 0; // Penalización: si hay especies mixtas, 0 puntos
        }
        
        // Calcular puntos según cantidad
        $count = count($placements);
        $pointsTable = [
            0 => 0,
            1 => 2,
            2 => 4,
            3 => 8,
            4 => 12,
            5 => 18,
            6 => 24
        ];
        
        $points = $pointsTable[$count] ?? 0;
        error_log("calculateSimilarityForestPoints: $count dinosaurios de especie {$species[0]} = $points puntos");
        
        return $points;
    }

    /**
     * Calcula puntos para el Prado de la Diferencia
     * REGLA: Todos los dinosaurios deben ser de ESPECIES DIFERENTES
     * Puntuación: [1,3,6,10,15,21] según cantidad de dinosaurios diferentes
     * @param array $placements Colocaciones en el recinto
     * @return int Puntos obtenidos
     */
    private function calculateDifferenceMeadowPoints(array $placements): int {
        if (empty($placements)) {
            return 0;
        }
        
        // VALIDACIÓN: Verificar que TODOS sean de especies DIFERENTES
        $species = array_map(fn($p) => (int)($p['species_id'] ?? 0), $placements);
        $uniqueSpecies = array_unique($species);
        
        if (count($uniqueSpecies) !== count($species)) {
            error_log("calculateDifferenceMeadowPoints: ERROR - Especies repetidas detectadas");
            return 0; // Penalización: si hay especies repetidas, 0 puntos
        }
        
        // Calcular puntos según cantidad (que debe ser igual a especies únicas)
        $count = count($uniqueSpecies);
        $pointsTable = [
            0 => 0,
            1 => 1,
            2 => 3,
            3 => 6,
            4 => 10,
            5 => 15,
            6 => 21
        ];
        
        $points = $pointsTable[$count] ?? 0;
        error_log("calculateDifferenceMeadowPoints: $count especies diferentes = $points puntos");
        
        return $points;
    }

    /**
     * Calcula puntos para la Pradera del Amor
     * REGLA: 5 puntos por cada PAREJA de la misma especie
     * Acepta cualquier combinación de especies
     * @param array $placements Colocaciones en el recinto
     * @return int Puntos obtenidos
     */
    private function calculateLovePrairiePoints(array $placements): int {
        if (empty($placements)) {
            return 0;
        }
        
        // Agrupar por especie
        $speciesCounts = [];
        foreach ($placements as $placement) {
            $speciesId = (int)($placement['species_id'] ?? 0);
            $speciesCounts[$speciesId] = ($speciesCounts[$speciesId] ?? 0) + 1;
        }

        $points = 0;
        $pairDetails = [];
        
        // Cada par suma 5 puntos
        foreach ($speciesCounts as $speciesId => $count) {
            $pairs = floor($count / 2);
            if ($pairs > 0) {
                $points += $pairs * 5;
                $pairDetails[] = "especie $speciesId: $pairs pareja(s)";
            }
        }
        
        error_log("calculateLovePrairiePoints: " . implode(", ", $pairDetails) . " = $points puntos");

        return $points; // Máximo 15 puntos (3 pares)
    }

    /**
     * Calcula puntos para el Trío Frondoso
     * REGLA: 7 puntos si tiene EXACTAMENTE 3 dinosaurios
     * @param array $placements Colocaciones en el recinto
     * @return int Puntos obtenidos
     */
    private function calculateTrioPoints(array $placements): int {
        $count = count($placements);
        $points = ($count === 3) ? 7 : 0;
        
        error_log("calculateTrioPoints: $count dinosaurios = $points puntos " . 
                  ($count === 3 ? "(EXACTAMENTE 3 ✅)" : "(necesita 3 ❌)"));
        
        return $points;
    }

    /**
     * Calcula puntos para el Rey de la Selva
     * REGLA CORRECTA: 7 puntos si el dinosaurio en el Rey es de la especie que MÁS tiene en su tablero
     * @param int $speciesId ID de la especie colocada en el Rey
     * @param int $gameId ID de la partida
     * @param int $playerSeat Asiento del jugador
     * @return int Puntos obtenidos
     */
    private function calculateKingOfJunglePoints(int $speciesId, int $gameId, int $playerSeat): int {
        // Obtener TODAS las colocaciones del jugador (en todos los recintos)
        $allPlacements = $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat);
        
        if (empty($allPlacements)) {
            return 0; // No debería pasar, pero por si acaso
        }
        
        // Contar cuántos dinosaurios tiene de cada especie en TODO su tablero
        $speciesCounts = [];
        foreach ($allPlacements as $placement) {
            $sid = (int)($placement['species_id'] ?? 0);
            $speciesCounts[$sid] = ($speciesCounts[$sid] ?? 0) + 1;
        }
        
        // Encontrar la especie mayoritaria (la que MÁS tiene)
        $maxCount = max($speciesCounts);
        $majoritySpecies = array_keys($speciesCounts, $maxCount);
        
        // Verificar si el dinosaurio del Rey es de la especie mayoritaria
        $isKing = in_array($speciesId, $majoritySpecies);
        
        error_log("calculateKingOfJunglePoints: species_id=$speciesId, counts=" . json_encode($speciesCounts) . 
                  ", majority=" . json_encode($majoritySpecies) . ", isKing=" . ($isKing ? 'YES' : 'NO'));
        
        // 7 puntos si es de la especie mayoritaria, 0 si no
        return $isKing ? 7 : 0;
    }

    /**
     * Calcula puntos para la Isla Solitaria
     * REGLA: 7 puntos si es la ÚNICA ocurrencia de la especie en TODO el tablero
     * @param int $speciesId ID de la especie
     * @param int $gameId ID de la partida
     * @param int $playerSeat Asiento del jugador
     * @return int Puntos obtenidos
     */
    private function calculateLonelyIslandPoints(int $speciesId, int $gameId, int $playerSeat): int {
        // Contar cuántas veces aparece esta especie en todos los recintos del jugador
        $totalCount = $this->placementRepo->countSpeciesForPlayer($gameId, $playerSeat, $speciesId);
        
        // Solo puntúa si es la única ocurrencia de esta especie
        $points = ($totalCount === 1) ? 7 : 0;
        
        error_log("calculateLonelyIslandPoints: especie $speciesId aparece $totalCount vez/veces = $points puntos " .
                  ($totalCount === 1 ? "(ÚNICA ✅)" : "(duplicada ❌)"));
        
        return $points;
    }

    // -----------------------------
    // UTILITY FUNCTIONS
    // -----------------------------

    /**
     * Mapea el código/color a un tipo de dinosaurio usado por la UI
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
            default: return $color;
        }
    }

    /**
     * Verifica si se acabó el tiempo del turno
     */
    private function isTurnTimedOut(array $game): bool {
        // DESACTIVADO: El timeout automático causaba que los dinosaurios se colocaran en el río incorrectamente
        // El frontend maneja el timeout con su propio timer
        return false;
        
        /* CÓDIGO ORIGINAL (desactivado):
        if (!isset($game['turn_started_at']) || empty($game['turn_started_at'])) {
            return false; // No hay timestamp, no se puede validar timeout
        }
        $turnStartTime = strtotime($game['turn_started_at']);
        if ($turnStartTime === false) {
            return false; // Timestamp inválido
        }
        return (time() - $turnStartTime) > $this->gameRules['TURN_TIME_LIMIT'];
        */
    }

    /**
     * Coloca automáticamente en el río cuando se acaba el tiempo
     */
    private function autoPlaceInRiver(int $gameId, int $playerSeat, int $bagContentId): bool {
        $riverEnclosureId = 7; // ID del río
        return $this->placeDino($gameId, $playerSeat, $bagContentId, $riverEnclosureId) &&
               $this->advanceTurn($gameId);
    }

    /**
     * Obtiene puntajes actuales de todos los jugadores (2-5 jugadores)
     * Retorna: puntaje acumulado (de rondas anteriores) + puntaje de la ronda actual
     * También incluye el conteo total de T-Rex para desempate
     */
    public function getCurrentScores(int $gameId): array {
        $totalPlayers = $this->getTotalPlayers($gameId);
        error_log("getCurrentScores: gameId=$gameId, totalPlayers=$totalPlayers");
        $scores = [];
        
        for ($i = 0; $i < $totalPlayers; $i++) {
            // Obtener puntaje acumulado de rondas anteriores
            $accumulatedScore = $this->getAccumulatedScore($gameId, $i);
            
            // Calcular puntaje de la ronda actual (basado en placements)
            $currentRoundScore = $this->calculateRoundScore($gameId, $i);
            
            // Total = acumulado + ronda actual
            $totalScore = $accumulatedScore + $currentRoundScore;
            
            // Obtener conteo de T-Rex acumulado
            $existingScore = $this->scoreRepo->getScore($gameId, $i);
            $accumulatedTrexCount = $existingScore ? (int)$existingScore['tiebreaker_trex_count'] : 0;
            
            // Contar T-Rex de la ronda actual
            $currentRoundTrexCount = $this->countAllTrexForPlayer($gameId, $i);
            
            // Total de T-Rex = acumulado + ronda actual
            $totalTrexCount = $accumulatedTrexCount + $currentRoundTrexCount;
            
            $scores[$i] = $totalScore;
            
            error_log("Player seat $i: Acumulado=$accumulatedScore, Ronda actual=$currentRoundScore, Total=$totalScore");
            error_log("Player seat $i: T-Rex acumulado=$accumulatedTrexCount, Ronda actual=$currentRoundTrexCount, Total=$totalTrexCount");
        }
        
        error_log("getCurrentScores RESULT: " . json_encode($scores));
        return $scores;
    }

    /**
     * Obtiene los puntajes y conteos de T-Rex de todos los jugadores
     * Retorna un array con información completa para determinar el ganador
     */
    public function getScoresWithTrex(int $gameId): array {
        $totalPlayers = $this->getTotalPlayers($gameId);
        $result = [];
        
        for ($i = 0; $i < $totalPlayers; $i++) {
            // Obtener puntaje acumulado
            $accumulatedScore = $this->getAccumulatedScore($gameId, $i);
            
            // Calcular puntaje de la ronda actual
            $currentRoundScore = $this->calculateRoundScore($gameId, $i);
            $totalScore = $accumulatedScore + $currentRoundScore;
            
            // Obtener T-Rex acumulado
            $existingScore = $this->scoreRepo->getScore($gameId, $i);
            $accumulatedTrexCount = $existingScore ? (int)$existingScore['tiebreaker_trex_count'] : 0;
            
            // Contar T-Rex de la ronda actual
            $currentRoundTrexCount = $this->countAllTrexForPlayer($gameId, $i);
            $totalTrexCount = $accumulatedTrexCount + $currentRoundTrexCount;
            
            $result[$i] = [
                'score' => $totalScore,
                'trex_count' => $totalTrexCount,
                'accumulated_score' => $accumulatedScore,
                'current_round_score' => $currentRoundScore
            ];
        }
        
        return $result;
    }

    /**
     * Valida las reglas específicas por recinto (sin dado)
     */
    private function validateEnclosureRules(int $gameId, int $playerSeat, int $enclosureId, int $bagContentId): bool {
        // Obtener recinto
        $enclosure = $this->placementRepo->getEnclosure($enclosureId);
        if (!$enclosure) {
            error_log("validateEnclosureRules: Recinto $enclosureId no encontrado");
            return false;
        }

        // Obtener colocaciones existentes en este recinto
        $existing = array_filter(
            $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat),
            fn($p) => (int)$p['enclosures_id'] === (int)$enclosureId
        );

        // Definir capacidades máximas por recinto
        $maxCapacities = [
            1 => 6, // Bosque de la Semejanza
            2 => 6, // Prado de la Diferencia
            3 => 6, // Pradera del Amor
            4 => 3, // Trío Frondoso
            5 => 1, // Rey de la Selva
            6 => 1, // Isla Solitaria
            7 => 6  // Río
        ];
        
        $max = $maxCapacities[$enclosureId] ?? 6;
        
        // VALIDACIÓN ESTRICTA: Verificar capacidad
        if (count($existing) >= $max) {
            error_log("validateEnclosureRules: Recinto $enclosureId lleno (" . count($existing) . "/$max)");
            return false;
        }

        // Obtener species_id del dinosaurio a colocar
        $speciesId = $this->bagRepo->getSpeciesIdByBagContentId($bagContentId);
        if ($speciesId === null) {
            error_log("validateEnclosureRules: No se pudo obtener species_id para bagContentId $bagContentId");
            return false;
        }

        // Especies actuales en el recinto
        $speciesInEnclosure = array_map(fn($p) => (int)($p['species_id'] ?? 0), $existing);

        // Validar reglas específicas por recinto
        switch ($enclosureId) {
            case 1: // Bosque de la Semejanza: TODOS deben ser de la misma especie
                if (empty($speciesInEnclosure)) {
                    return true; // Primera colocación, siempre válida
                }
                // TODOS deben ser iguales, verificar que el nuevo coincida
                $firstSpecies = $speciesInEnclosure[0];
                $allSame = count(array_unique($speciesInEnclosure)) === 1;
                if (!$allSame) {
                    error_log("validateEnclosureRules: Recinto 1 ya tiene especies mixtas (ERROR DE ESTADO)");
                    return false;
                }
                if ($speciesId !== $firstSpecies) {
                    error_log("validateEnclosureRules: Recinto 1 requiere especie $firstSpecies, intentando colocar $speciesId");
                    return false;
                }
                return true;
                
            case 2: // Prado de la Diferencia: TODOS deben ser de especies diferentes
                if (in_array($speciesId, $speciesInEnclosure, true)) {
                    error_log("validateEnclosureRules: Recinto 2 ya tiene especie $speciesId");
                    return false;
                }
                return true;
                
            case 3: // Pradera del Amor: sin restricción de especie (solo capacidad)
                return true;
                
            case 4: // Trío Frondoso: exactamente 3 dinosaurios
                // Ya verificamos capacidad arriba (max 3)
                return true;
                
            case 5: // Rey de la Selva: máximo 1 dinosaurio
                // Ya verificamos capacidad arriba (max 1)
                return true;
                
            case 6: // Isla Solitaria: máx 1 y la especie NO debe aparecer en otros recintos
                // Ya verificamos que está vacío (max 1)
                $totalOfSpecies = $this->placementRepo->countSpeciesForPlayer($gameId, $playerSeat, $speciesId);
                if ($totalOfSpecies > 0) {
                    error_log("validateEnclosureRules: Recinto 6 (Isla Solitaria) - especie $speciesId ya existe en otro recinto");
                    return false;
                }
                return true;
                
            case 7: // Río: sin restricciones específicas
                return true;
                
            default:
                error_log("validateEnclosureRules: Recinto $enclosureId no reconocido");
                return false;
        }
    }

    /**
     * Obtiene el número total de jugadores activos en la partida
     */
    private function getTotalPlayers(int $gameId): int {
        $game = $this->gameRepo->getGameById($gameId);
        if (!$game) return 2; // Default a 2 jugadores
        
        $count = 0;
        if (!empty($game['player1_user_id'])) $count++;
        if (!empty($game['player2_user_id'])) $count++;
        if (!empty($game['player3_user_id'])) $count++;
        if (!empty($game['player4_user_id'])) $count++;
        if (!empty($game['player5_user_id'])) $count++;
        
        return $count > 0 ? $count : 2; // Mínimo 2 jugadores
    }

    /**
     * Calcula el número de turnos por ronda basado en el número de jugadores
     * Cada jugador coloca 6 dinosaurios por ronda
     * @param int $gameId ID del juego
     * @return int Número de turnos por ronda (totalPlayers * 6)
     */
    private function getTurnsPerRound(int $gameId): int {
        $totalPlayers = $this->getTotalPlayers($gameId);
        return $totalPlayers * 6; // 2 jugadores = 12, 3 = 18, 4 = 24, 5 = 30
    }

    /**
     * Avanza al siguiente turno/ronda
     */
    private function advanceTurn(int $gameId): bool {
        $game = $this->gameRepo->getGameById($gameId);
        $currentTurn = isset($game['current_turn']) ? (int)$game['current_turn'] : 0;
        $currentRound = isset($game['current_round']) ? (int)$game['current_round'] : 1;
        $activeSeat = isset($game['active_seat']) ? (int)$game['active_seat'] : 0;

        // Obtener número total de jugadores
        $totalPlayers = $this->getTotalPlayers($gameId);
        
        // Cambiar jugador activo (circular: 0->1->2->3->4->0)
        $nextSeat = ($activeSeat + 1) % $totalPlayers;

        // VERIFICAR cantidades después de colocar
        error_log("=== ADVANCE TURN: Verificación de cantidades ===");
        $totalRemaining = 0;
        for ($i = 0; $i < $totalPlayers; $i++) {
            $remaining = count($this->bagRepo->getDinosInBag($gameId, $i));
            $totalRemaining += $remaining;
            error_log("  Jugador $i: $remaining dinosaurios no jugados");
        }
        
        error_log("advanceTurn: TOTAL de dinosaurios restantes = $totalRemaining");
        
        // DIAGNÓSTICO COMPLETO
        $this->bagRepo->diagnoseBagState($gameId);

        if ($totalRemaining <= 0) {
            // Fin de ronda: ¿terminó el juego?
            if ($currentRound >= $this->gameRules['MAX_ROUNDS']) {
                return $this->endGame($gameId);
            }
            return $this->startNewRound($gameId);
        }

        // RF14 y RF18: Si todos los jugadores han colocado (nextSeat vuelve a 0 después de un ciclo completo),
        // resetear el dado y pasar los dinosaurios restantes al siguiente jugador
        // Todos han colocado cuando: nextSeat === 0 (vuelve al primer jugador) Y el turno completado es múltiplo de totalPlayers
        // Ejemplo: 2 jugadores - Turno 1: P0 coloca, turn=2, nextSeat=1 (aún no todos)
        //                  Turno 2: P1 coloca, turn=3, nextSeat=0 -> TODOS HAN COLOCADO (turn 3-1=2, 2%2=0)
        // El turno actual (currentTurn) es el número del turno que acaba de terminar
        // Cuando nextSeat vuelve a 0 Y (currentTurn - 1) es múltiplo de totalPlayers, todos han colocado
        $allPlayersPlaced = ($nextSeat === 0 && $currentTurn > 1 && (($currentTurn - 1) % $totalPlayers === 0));
        
        if ($allPlayersPlaced) {
            error_log("=== TODOS LOS JUGADORES HAN COLOCADO ===");
            error_log("RF14: Reseteando el dado (todos han colocado)");
            error_log("RF18: Pasando dinosaurios restantes al siguiente jugador");
            
            // RF14: Resetear el dado - eliminar todas las tiradas del dado
            $this->dieRepo->clearDieRollsForGame($gameId);
            error_log("✅ Dado reseteado");
            
            // RF18: Pasar dinosaurios restantes al siguiente jugador según la dirección del juego
            $room = $this->roomRepo->getRoomByGameId($gameId);
            $gameDirection = $room && isset($room['game_direction']) ? $room['game_direction'] : 'clockwise';
            error_log("Dirección del juego: $gameDirection");
            
            if (!$this->passRemainingDinosToNextPlayer($gameId, $gameDirection, $totalPlayers)) {
                error_log("ERROR: No se pudieron pasar los dinosaurios al siguiente jugador");
                // Continuar de todas formas, pero registrar el error
            }
        }

        // Si no terminó la ronda aún, avanzar turno dentro de la ronda
        $nextTurn = $currentTurn + 1;
        return $this->gameRepo->updateGameState(
            $gameId,
            $nextSeat,
            $nextTurn,
            $currentRound
        );
    }
    
    /**
     * RF18: Pasa los dinosaurios restantes de cada jugador al siguiente según la dirección del juego
     * @param int $gameId ID del juego
     * @param string $direction Dirección del juego ('clockwise' o 'counterclockwise')
     * @param int $totalPlayers Número total de jugadores
     * @return bool true si se pasaron exitosamente
     */
    private function passRemainingDinosToNextPlayer(int $gameId, string $direction, int $totalPlayers): bool {
        error_log("=== PASANDO DINOSAURIOS RESTANTES (RF18) ===");
        error_log("Dirección: $direction, Total jugadores: $totalPlayers");
        
        // Obtener todas las bolsas del juego
        $bags = $this->bagRepo->getBagsForGame($gameId);
        if (empty($bags) || count($bags) !== $totalPlayers) {
            error_log("ERROR: No se pudieron obtener las bolsas del juego");
            return false;
        }
        
        // Ordenar bolsas por player_seat (asiento del jugador)
        // Las bolsas están asociadas a user_id, necesitamos mapear a player_seat
        $game = $this->gameRepo->getGameById($gameId);
        $playerSeatToBagId = [];
        
        // Mapear player_seat a bag_id
        for ($seat = 0; $seat < $totalPlayers; $seat++) {
            $playerKey = 'player' . ($seat + 1) . '_user_id';
            $userId = $game[$playerKey] ?? null;
            if ($userId) {
                foreach ($bags as $bag) {
                    if ($bag['user_id'] == $userId) {
                        $playerSeatToBagId[$seat] = $bag['bag_id'];
                        break;
                    }
                }
            }
        }
        
        if (count($playerSeatToBagId) !== $totalPlayers) {
            error_log("ERROR: No se pudieron mapear todas las bolsas a player_seat");
            return false;
        }
        
        // Determinar el orden de paso según la dirección
        // clockwise: 0->1->2->3->4->0 (cada uno pasa al siguiente)
        // counterclockwise: 0->4->3->2->1->0 (cada uno pasa al anterior)
        $passOrder = [];
        if ($direction === 'clockwise') {
            for ($i = 0; $i < $totalPlayers; $i++) {
                $fromSeat = $i;
                $toSeat = ($i + 1) % $totalPlayers;
                $passOrder[] = ['from' => $fromSeat, 'to' => $toSeat];
            }
        } else {
            // counterclockwise
            for ($i = 0; $i < $totalPlayers; $i++) {
                $fromSeat = $i;
                $toSeat = ($i - 1 + $totalPlayers) % $totalPlayers;
                $passOrder[] = ['from' => $fromSeat, 'to' => $toSeat];
            }
        }
        
        error_log("Orden de paso: " . json_encode($passOrder));
        
        // Obtener todos los dinosaurios no jugados de cada bolsa
        $dinosToTransfer = [];
        foreach ($passOrder as $transfer) {
            $fromSeat = $transfer['from'];
            $fromBagId = $playerSeatToBagId[$fromSeat];
            
            // Obtener dinosaurios no jugados de la bolsa de origen
            $remainingDinos = $this->bagRepo->getDinosInBag($gameId, $fromSeat);
            $dinosToTransfer[$fromSeat] = [
                'fromBagId' => $fromBagId,
                'toSeat' => $transfer['to'],
                'toBagId' => $playerSeatToBagId[$transfer['to']],
                'dinos' => array_map(fn($d) => $d['bag_content_id'] ?? $d['dino_id'] ?? null, $remainingDinos)
            ];
            
            // Filtrar nulls
            $dinosToTransfer[$fromSeat]['dinos'] = array_filter($dinosToTransfer[$fromSeat]['dinos'], fn($id) => $id !== null);
            
            error_log("Jugador $fromSeat -> Jugador {$transfer['to']}: " . count($dinosToTransfer[$fromSeat]['dinos']) . " dinosaurios a transferir");
        }
        
        // Transferir los dinosaurios
        $success = true;
        foreach ($dinosToTransfer as $fromSeat => $transfer) {
            $fromBagId = $transfer['fromBagId'];
            $toBagId = $transfer['toBagId'];
            $dinoIds = $transfer['dinos'];
            
            if (empty($dinoIds)) {
                error_log("Jugador $fromSeat: No hay dinosaurios para transferir");
                continue;
            }
            
            error_log("Transferiendo " . count($dinoIds) . " dinosaurios de bolsa $fromBagId a bolsa $toBagId");
            
            // Transferir cada dinosaurio
            foreach ($dinoIds as $dinoId) {
                if (!$this->bagRepo->transferDinoToBag($dinoId, $toBagId)) {
                    error_log("ERROR: No se pudo transferir dinosaurio $dinoId de bolsa $fromBagId a bolsa $toBagId");
                    $success = false;
                }
            }
        }
        
        error_log("=== FIN DE TRANSFERENCIA DE DINOSAURIOS (RF18) ===");
        return $success;
    }

    /**
     * Inicia una nueva ronda
     * IMPORTANTE: Calcula los puntajes de la ronda actual, los acumula y luego limpia el tablero
     */
    private function startNewRound(int $gameId): bool {
        // Obtener estado actual del juego
        $game = $this->gameRepo->getGameById($gameId);
        $totalPlayers = $this->getTotalPlayers($gameId);
        $currentRound = isset($game['current_round']) ? (int)$game['current_round'] : 1;

        error_log("=== STARTING NEW ROUND for game $gameId ===");
        error_log("Finalizando ronda $currentRound, comenzando ronda " . ($currentRound + 1));

        // PASO 1: Calcular los puntajes de la ronda actual (basados en los placements actuales)
        error_log("=== PASO 1: CALCULANDO PUNTAJES DE RONDA $currentRound ===");
        $roundScores = [];
        for ($i = 0; $i < $totalPlayers; $i++) {
            // Calcular puntaje basado en los placements actuales (sin guardar aún)
            $roundScore = $this->calculateRoundScore($gameId, $i);
            $roundScores[$i] = $roundScore;
            error_log("Jugador $i: $roundScore puntos en ronda $currentRound");
        }

        // PASO 2: Contar T-Rex de la ronda actual ANTES de eliminar placements
        error_log("=== PASO 2: CONTANDO T-REX DE RONDA $currentRound ===");
        $roundTrexCounts = [];
        for ($i = 0; $i < $totalPlayers; $i++) {
            $trexCount = $this->countAllTrexForPlayer($gameId, $i);
            $roundTrexCounts[$i] = $trexCount;
            error_log("Jugador $i: $trexCount T-Rex en ronda $currentRound");
        }

        // PASO 3: Acumular los puntajes y T-Rex de la ronda a los totales
        error_log("=== PASO 3: ACUMULANDO PUNTAJES Y T-REX ===");
        for ($i = 0; $i < $totalPlayers; $i++) {
            $existingScore = $this->scoreRepo->getScore($gameId, $i);
            $existingTotal = $existingScore ? (int)$existingScore['total_points'] : 0;
            $existingTrexCount = $existingScore ? (int)$existingScore['tiebreaker_trex_count'] : 0;
            
            $newTotal = $existingTotal + $roundScores[$i];
            $newTrexCount = $existingTrexCount + $roundTrexCounts[$i];
            
            error_log("Jugador $i: Puntaje existente = $existingTotal, Ronda actual = {$roundScores[$i]}, Total acumulado = $newTotal");
            error_log("Jugador $i: T-Rex existente = $existingTrexCount, Ronda actual = {$roundTrexCounts[$i]}, Total acumulado = $newTrexCount");
            
            // Guardar el puntaje acumulado y el conteo de T-Rex acumulado
            $this->scoreRepo->saveScore($gameId, $i, $newTotal, 0, 0, $newTrexCount, false);
        }

        // PASO 4: Eliminar TODOS los placements para limpiar el tablero
        error_log("=== PASO 4: LIMPIANDO TABLERO (eliminando placements) ===");
        $this->placementRepo->deletePlacementsByGame($gameId);
        error_log("✅ Todos los placements eliminados - tablero limpio");

        // PASO 5: Limpiar las bolsas y llenar con nuevos dinosaurios
        error_log("=== PASO 5: RECARGANDO BOLSAS PARA NUEVA RONDA ===");
        $success = $this->bagRepo->fillBagsRandomlyWithSpecies($gameId, $this->gameRules['DINOS_PER_PLAYER'], true);
        
        if (!$success) {
            error_log("Failed to fill bags for new round");
            return false;
        }

        error_log("Bags filled for new round");
        
        // VERIFICAR que cada jugador tiene exactamente 6 dinosaurios en su bolsa
        $allCorrect = true;
        for ($i = 0; $i < $totalPlayers; $i++) {
            $count = count($this->bagRepo->getDinosInBag($gameId, $i));
            error_log("startNewRound: Jugador $i tiene $count dinosaurios en bolsa");
            if ($count !== 6) {
                error_log("ERROR: Jugador $i debería tener 6 dinosaurios en bolsa, tiene $count");
                $allCorrect = false;
            }
        }
        
        if (!$allCorrect) {
            error_log("ERROR CRÍTICO: Las bolsas no tienen la cantidad correcta después de fillBags");
            return false;
        }
        
        error_log("✅ Verificación: Todos los jugadores tienen exactamente 6 dinosaurios en bolsa");
        error_log("✅ Tablero limpio y listo para la nueva ronda");

        // PASO 6: Reiniciar turno a 1 y avanzar ronda
        return $this->gameRepo->updateGameState(
            $gameId,
            0, // Primer jugador inicia
            1, // Primer turno de la nueva ronda
            $currentRound + 1
        );
    }

    /**
     * Calcula el puntaje de la ronda actual basado en los placements existentes
     * (sin guardar, solo para calcular)
     */
    private function calculateRoundScore(int $gameId, int $playerSeat): int
    {
        $this->gameId = $gameId;
        $this->playerSeat = $playerSeat;

        $placements = $this->placementRepo->getPlacementsByPlayer($gameId, $playerSeat);
        
        if (count($placements) === 0) {
            return 0;
        }
        
        $totalPoints = 0;

        // Agrupar placements por recinto
        $enclosurePlacements = [];
        foreach ($placements as $placement) {
            $enclosureId = $placement['enclosures_id'];
            $enclosurePlacements[$enclosureId][] = $placement;
        }
        
        // Calcular puntos por cada recinto
        foreach ($enclosurePlacements as $enclosureId => $enclosurePlacements) {
            $points = $this->calculatePointsForEnclosure($enclosureId, $enclosurePlacements);
            $totalPoints += $points;
        }

        // Bono: +1 por cada dinosaurio rojo (T-Rex) en cualquier recinto EXCEPTO el río
        foreach ($placements as $p) {
            $color = strtolower($p['dino_color'] ?? '');
            $enclosureId = (int)($p['enclosures_id'] ?? 0);
            
            if (($color === 'rojo' || $color === 'red') && $enclosureId !== 7) {
                $totalPoints += 1;
            }
        }

        return $totalPoints;
    }

    /**
     * Cuenta todos los T-Rex (species_id = 2) que un jugador tiene en su tablero
     * IMPORTANTE: Cuenta TODOS los T-Rex, incluyendo los del río
     * @param int $gameId ID del juego
     * @param int $playerSeat Asiento del jugador
     * @return int Cantidad de T-Rex
     */
    private function countAllTrexForPlayer(int $gameId, int $playerSeat): int
    {
        // T-Rex tiene species_id = 2
        $trexSpeciesId = 2;
        return $this->placementRepo->countSpeciesForPlayer($gameId, $playerSeat, $trexSpeciesId);
    }

    /**
     * Finaliza el juego y calcula puntuaciones finales
     * IMPORTANTE: Cuenta T-Rex para desempate
     */
    private function endGame(int $gameId): bool {
        $totalPlayers = $this->getTotalPlayers($gameId);
        $game = $this->gameRepo->getGameById($gameId);
        $currentRound = isset($game['current_round']) ? (int)$game['current_round'] : 1;
        
        error_log("Ending game for $totalPlayers players (ronda $currentRound)");
        
        // Calcular puntajes y T-Rex de la ronda final y acumularlos
        error_log("=== CALCULANDO PUNTAJES FINALES ===");
        for ($i = 0; $i < $totalPlayers; $i++) {
            // Calcular puntaje de la ronda actual
            $roundScore = $this->calculateRoundScore($gameId, $i);
            
            // Contar T-Rex de la ronda final
            $roundTrexCount = $this->countAllTrexForPlayer($gameId, $i);
            
            // Obtener puntaje y T-Rex acumulados
            $existingScore = $this->scoreRepo->getScore($gameId, $i);
            $accumulatedScore = $existingScore ? (int)$existingScore['total_points'] : 0;
            $accumulatedTrexCount = $existingScore ? (int)$existingScore['tiebreaker_trex_count'] : 0;
            
            // Totales finales
            $finalScore = $accumulatedScore + $roundScore;
            $finalTrexCount = $accumulatedTrexCount + $roundTrexCount;
            
            // Guardar el puntaje final y el conteo total de T-Rex
            $this->scoreRepo->saveScore($gameId, $i, $finalScore, 0, 0, $finalTrexCount, false);
            
            error_log("Player $i: Acumulado=$accumulatedScore, Ronda final=$roundScore, Total final=$finalScore");
            error_log("Player $i: T-Rex acumulado=$accumulatedTrexCount, Ronda final=$roundTrexCount, Total final=$finalTrexCount");
        }

        // Marcar juego como completado
        return $this->gameRepo->updateGameStatus($gameId, 'COMPLETED');
    }

    /**
     * Verifica si el jugador es el activo en este turno
     * @param array $game Datos del juego actual
     * @param int $playerSeat Asiento del jugador a verificar
     * @return bool true si es el jugador activo
     */
    private function isActivePlayer(array $game, int $playerSeat): bool {
        // Si no hay active_seat definido, asumir que el primer jugador (asiento 0) está activo
        if (!isset($game['active_seat'])) {
            return $playerSeat === 0;
        }
        return $game['active_seat'] === $playerSeat;
    }

    /**
     * Procesa un turno completo del juego
     */
    public function processTurn(int $gameId, int $playerSeat, int $bagContentId, int $enclosureId, ?int $slotIndex = null): bool {
        $game = $this->gameRepo->getGameById($gameId);
        
        error_log("Procesando turno: GameID=$gameId, PlayerSeat=$playerSeat, DinoID=$bagContentId, EnclosureID=$enclosureId");
        error_log("Datos del juego: " . json_encode($game));
        
        // 1. Validar turno y tiempo
        if (!$this->validateTurnAndTime($game, $playerSeat, $gameId, $bagContentId)) {
            error_log("Error: Validación de turno y tiempo fallida");
            return false;
        }

        // 2. VALIDACIÓN ESTRICTA: El dinosaurio DEBE pertenecer a la bolsa del jugador
        if (!$this->bagRepo->isDinoInPlayerBag($bagContentId, $gameId, $playerSeat)) {
            error_log("ERROR: Dinosaurio $bagContentId NO pertenece a la bolsa del jugador $playerSeat en juego $gameId");
            return false;
        }

        // 3. Validación de reglas por recinto (sin dado)
        if (!$this->validateEnclosureRules($gameId, $playerSeat, $enclosureId, $bagContentId)) {
            error_log("Error: Colocación inválida por regla del recinto $enclosureId");
            return false;
        }

        // 4. VALIDACIÓN ESTRICTA: Aplicar restricciones del dado
        if (!$this->validateDieRestriction($gameId, $playerSeat, $enclosureId)) {
            error_log("Error: No se cumple la restricción del dado para el recinto $enclosureId");
            return false;
        }

        // 5. Colocar dinosaurio
        if (!$this->placeDino($gameId, $playerSeat, $bagContentId, $enclosureId, $slotIndex)) {
            error_log("Error: No se pudo colocar el dinosaurio");
            return false;
        }

        // 6. Avanzar turno (intercambiar bolsas y gestionar rondas)
        error_log("Avanzando turno...");
        $result = $this->advanceTurn($gameId);
        error_log("Turno avanzado: " . ($result ? "Éxito" : "Error"));
        return $result;
    }

    /**
     * Valida el turno y el tiempo límite
     * @param array $game Datos del juego
     * @param int $playerSeat Asiento del jugador
     * @param int $gameId ID del juego
     * @param int $bagContentId ID del contenido de la bolsa
     * @return bool true si las validaciones son correctas
     */
    private function validateTurnAndTime(array $game, int $playerSeat, int $gameId, int $bagContentId): bool {
        // Verificar que active_seat esté definido
        if (!isset($game['active_seat'])) {
            // Si no está definido, actualizamos el juego con valores predeterminados
            $this->gameRepo->updateGameState($gameId, 0, 1, 1);
            $game['active_seat'] = 0;
        }
        
        // VALIDACIÓN ESTRICTA: Solo el jugador activo puede colocar
        $activeSeat = isset($game['active_seat']) ? (int)$game['active_seat'] : 0;
        if ($activeSeat !== $playerSeat) {
            error_log("ERROR: No es el turno del jugador $playerSeat. Turno actual: $activeSeat");
            throw new Exception("No es tu turno. El turno actual es del jugador en el asiento $activeSeat.");
        }

        // Validar tiempo límite
        if ($this->isTurnTimedOut($game)) {
            return $this->autoPlaceInRiver($gameId, $playerSeat, $bagContentId);
        }

        return true;
    }
}
?>