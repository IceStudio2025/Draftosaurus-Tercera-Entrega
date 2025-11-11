-- ============================================================================
-- CREACIÓN DE LA BASE DE DATOS DRAFTOSAURUS
-- ============================================================================
-- Este script crea la base de datos completa para el juego Draftosaurus Digital
-- Incluye todas las tablas, índices, datos de prueba y procedimientos almacenados
-- 
-- CAMBIOS RECIENTES:
-- - Agregada columna 'board_type' a la tabla 'rooms' (primavera/verano)
-- - Sistema de turnos validado en backend y frontend
-- - Soporte para salas multijugador con selección de tablero
-- ============================================================================

-- Creación de la base de datos Draftosaurus
CREATE DATABASE IF NOT EXISTS draftosaurus;
USE draftosaurus;
-- drop database draftosaurus;
-- Eliminación de tablas existentes si fuera necesario (comentar si no se desea eliminar)
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS final_score;
-- DROP TABLE IF EXISTS placement;
-- DROP TABLE IF EXISTS placement_die_rolls;
-- DROP TABLE IF EXISTS bag_contents;
-- DROP TABLE IF EXISTS bags;
-- DROP TABLE IF EXISTS enclosures;
-- DROP TABLE IF EXISTS species;
-- DROP TABLE IF EXISTS games;
-- DROP TABLE IF EXISTS users;
-- SET FOREIGN_KEY_CHECKS = 1;

-- Creación de tablas
CREATE TABLE users (
  user_id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  username       VARCHAR(50) NOT NULL UNIQUE,
  email          VARCHAR(120) NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('PLAYER','ADMIN') DEFAULT 'PLAYER' NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE games (
  game_id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  status         ENUM('IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  player1_user_id BIGINT NULL,
  player2_user_id BIGINT NULL,
  player3_user_id BIGINT NULL,
  player4_user_id BIGINT NULL,
  player5_user_id BIGINT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at    TIMESTAMP NULL,
  turn_started_at TIMESTAMP NULL,
  current_round TINYINT NOT NULL DEFAULT 1,
  current_turn INT DEFAULT 0,
  active_seat TINYINT DEFAULT 0,
  CONSTRAINT fk_game_p1_user FOREIGN KEY (player1_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_game_p2_user FOREIGN KEY (player2_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_game_p3_user FOREIGN KEY (player3_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_game_p4_user FOREIGN KEY (player4_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_game_p5_user FOREIGN KEY (player5_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE species (
    species_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL DEFAULT 'unknown',
    img VARCHAR(100) NOT NULL
);

CREATE TABLE bags (
  bag_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  user_id BIGINT,
  FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE bag_contents (
  bag_content_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  bag_id BIGINT NOT NULL,
  species_id BIGINT NOT NULL,
  is_played BOOLEAN NOT NULL DEFAULT 0,  -- 0 = en bolsa, 1 = ya jugado
  FOREIGN KEY (bag_id) REFERENCES bags(bag_id) ON DELETE CASCADE,
  FOREIGN KEY (species_id) REFERENCES species(species_id)
);

CREATE TABLE enclosures(
  enclosures_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name_enclosures VARCHAR(50) NOT NULL,
  position ENUM('left', 'right', 'center') NOT NULL DEFAULT 'center',
  terrain ENUM('forest', 'rock', 'mixed') NOT NULL DEFAULT 'mixed',
  special_rule ENUM(
      'SAME_SPECIES',      
      'DIFFERENT_SPECIES', 
      'PAIRS_BONUS',       
      'TRIO_REQUIRED',     
      'MAJORITY_SPECIES',  
      'UNIQUE_SPECIES',    
      'NO_RESTRICTIONS'    
  ) NOT NULL DEFAULT 'NO_RESTRICTIONS',
  max_dinos	  INT NOT NULL	
);

-- Tabla de salas (rooms)
-- Almacena la información de las salas de juego multijugador
-- board_type: Tipo de tablero seleccionado ('primavera' o 'verano')
--             Todos los jugadores en la sala verán el mismo tablero
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    admin_user_id BIGINT NOT NULL,
    max_players TINYINT NOT NULL DEFAULT 2,
    game_direction VARCHAR(20) NOT NULL DEFAULT 'clockwise',
    board_type VARCHAR(20) NOT NULL DEFAULT 'primavera', -- 'primavera' o 'verano'
    status ENUM('WAITING', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'WAITING',
    game_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(user_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
);

-- Jugadores en sala
CREATE TABLE IF NOT EXISTS room_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    player_seat TINYINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE KEY unique_room_user (room_id, user_id)
);

CREATE TABLE placement (
  placement_id   BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id        BIGINT NOT NULL,
  dino_id        BIGINT NOT NULL,   -- referencia a bag_contents
  enclosures_id  BIGINT NOT NULL,   -- referencia a recintos
  player_seat    TINYINT NOT NULL,  -- 0 = player1, 1 = player2, etc.
  slot_index     TINYINT NULL,
  placed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pl_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
  CONSTRAINT fk_pl_dino FOREIGN KEY (dino_id) REFERENCES bag_contents(bag_content_id) ON DELETE CASCADE,
  CONSTRAINT fk_pl_enclosures FOREIGN KEY (enclosures_id) REFERENCES enclosures(enclosures_id) ON DELETE CASCADE,
  UNIQUE KEY uq_enclosure_slot (game_id, player_seat, enclosures_id, slot_index)
);

CREATE TABLE final_score (
  game_id             BIGINT NOT NULL,
  player_seat         TINYINT NOT NULL,  -- 0, 1, 2, 3, 4
  total_points        SMALLINT NOT NULL,
  river_points        SMALLINT NOT NULL,
  trex_bonus_points   SMALLINT NOT NULL,
  tiebreaker_trex_count SMALLINT NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (game_id, player_seat),
  CONSTRAINT fk_fs_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

CREATE TABLE placement_die_rolls (
  roll_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  affected_player_seat TINYINT NOT NULL,  -- 0, 1, 2, 3, 4
  die_face ENUM(
      'LEFT_SIDE',
      'RIGHT_SIDE',
      'FOREST',
      'EMPTY',
      'NO_TREX',
      'ROCKS'
  ) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rolls_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

-- Índices para mejorar rendimiento
CREATE INDEX ix_placement_board ON placement (game_id, player_seat, enclosures_id);

-- Índices adicionales para optimizar consultas del historial
CREATE INDEX idx_games_status_finished ON games(status, finished_at);
CREATE INDEX idx_games_player1 ON games(player1_user_id);
CREATE INDEX idx_games_player2 ON games(player2_user_id);
CREATE INDEX idx_games_player3 ON games(player3_user_id);
CREATE INDEX idx_games_player4 ON games(player4_user_id);
CREATE INDEX idx_games_player5 ON games(player5_user_id);

-- Insertar usuarios de prueba (6 jugadores)
-- Contraseñas de los usuarios (almacenadas en texto plano):
-- Enzo: Enzo123
-- Juan: Juan123
-- Axel: Axel123
-- Morena: Morena123
-- Julieta: Julieta123
-- IceStudio2025: IceStudio2025
INSERT INTO users (username, email, password_hash, role) VALUES 
('Enzo', 'enzo@gmail.com', 'Enzo123', 'PLAYER'),
('Juan', 'juan@gmail.com', 'Juan123', 'PLAYER'),
('Axel', 'axel@gmail.com', 'Axel123', 'PLAYER'),
('Morena', 'morena@gmail.com', 'Morena123', 'PLAYER'),
('Julieta', 'julieta@gmail.com', 'Julieta123', 'PLAYER'),
('IceStudio2025', 'IceStudio2025@gmail.com', 'IceStudio2025', 'PLAYER');

-- Insertar especies de dinosaurios
INSERT INTO species (species_id, name, code, img) VALUES
(1, 'Triceratops Amarillo', 'amarillo', './img/amarilloHori.PNG'),
(2, 'T-Rex Rojo', 'rojo', './img/rojoHori.PNG'),
(3, 'Estegosaurio Verde', 'verde', './img/verdeHori.PNG'),
(4, 'Diplodocus Azul', 'azul', './img/azulHori.PNG'),
(5, 'Alosaurio Rosa', 'rosa', './img/rosaHori.PNG'),
(6, 'Velociraptor Naranja', 'naranja', './img/naranjaHori.PNG');

-- Insertar recintos
INSERT INTO enclosures (enclosures_id, name_enclosures, position, terrain, special_rule, max_dinos) VALUES
(1, 'Bosque de Semejanza', 'left', 'forest', 'SAME_SPECIES', 6),
(2, 'Parado Diferencia', 'left', 'rock', 'DIFFERENT_SPECIES', 6),
(3, 'Pradera del Amor', 'right', 'mixed', 'PAIRS_BONUS', 6),
(4, 'Trio Frondoso', 'center', 'forest', 'TRIO_REQUIRED', 3),
(5, 'Rey de la Selva', 'right', 'forest', 'MAJORITY_SPECIES', 1),
(6, 'Isla Solitaria', 'center', 'rock', 'UNIQUE_SPECIES', 1),
(7, 'Rio', 'center', 'mixed', 'NO_RESTRICTIONS', 6);

-- Crear una partida en progreso con 5 jugadores
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, player3_user_id, player4_user_id, player5_user_id, created_at, turn_started_at, current_round, current_turn, active_seat)
VALUES (1, 'IN_PROGRESS', 1, 2, 3, 4, 5, NOW(), NOW(), 1, 3, 0);

-- Crear bolsas para los 5 jugadores
INSERT INTO bags (bag_id, game_id, user_id) VALUES
(1, 1, 1), -- Bolsa del jugador 1
(2, 1, 2), -- Bolsa del jugador 2
(3, 1, 3), -- Bolsa del jugador 3
(4, 1, 4), -- Bolsa del jugador 4
(5, 1, 5); -- Bolsa del jugador 5

-- Insertar dinosaurios en la bolsa del jugador 1
INSERT INTO bag_contents (bag_content_id, bag_id, species_id, is_played) VALUES
(1, 1, 1, 0), -- Amarillo disponible
(2, 1, 2, 0), -- Rojo disponible
(3, 1, 3, 0), -- Verde disponible
(4, 1, 4, 1), -- Azul ya jugado
(5, 1, 5, 0), -- Rosa disponible
(6, 1, 6, 1); -- Naranja ya jugado

-- Insertar dinosaurios en la bolsa del jugador 2
INSERT INTO bag_contents (bag_content_id, bag_id, species_id, is_played) VALUES
(7, 2, 1, 0),  -- Amarillo disponible
(8, 2, 2, 0),  -- Rojo disponible
(9, 2, 3, 0),  -- Verde disponible
(10, 2, 4, 0), -- Azul disponible
(11, 2, 5, 1), -- Rosa ya jugado
(12, 2, 6, 0); -- Naranja disponible

-- Insertar dinosaurios en la bolsa del jugador 3
INSERT INTO bag_contents (bag_content_id, bag_id, species_id, is_played) VALUES
(13, 3, 1, 0), -- Amarillo disponible
(14, 3, 2, 1), -- Rojo ya jugado
(15, 3, 3, 0), -- Verde disponible
(16, 3, 4, 0), -- Azul disponible
(17, 3, 5, 0), -- Rosa disponible
(18, 3, 6, 0); -- Naranja disponible

-- Insertar dinosaurios en la bolsa del jugador 4
INSERT INTO bag_contents (bag_content_id, bag_id, species_id, is_played) VALUES
(19, 4, 1, 0), -- Amarillo disponible
(20, 4, 2, 0), -- Rojo disponible
(21, 4, 3, 0), -- Verde disponible
(22, 4, 4, 0), -- Azul disponible
(23, 4, 5, 0), -- Rosa disponible
(24, 4, 6, 1); -- Naranja ya jugado

-- Insertar dinosaurios en la bolsa del jugador 5
INSERT INTO bag_contents (bag_content_id, bag_id, species_id, is_played) VALUES
(25, 5, 1, 1), -- Amarillo ya jugado
(26, 5, 2, 0), -- Rojo disponible
(27, 5, 3, 0), -- Verde disponible
(28, 5, 4, 0), -- Azul disponible
(29, 5, 5, 0), -- Rosa disponible
(30, 5, 6, 0); -- Naranja disponible

-- Registrar colocaciones de dinosaurios ya realizadas
-- Jugador 1 ha colocado 2 dinosaurios
INSERT INTO placement (placement_id, game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at) VALUES
(1, 1, 4, 1, 0, 0, DATE_SUB(NOW(), INTERVAL 10 MINUTE)), -- Azul en Bosque de Semejanza
(2, 1, 6, 3, 0, 0, DATE_SUB(NOW(), INTERVAL 5 MINUTE));  -- Naranja en Pradera del Amor

-- Jugador 2 ha colocado 1 dinosaurio
INSERT INTO placement (placement_id, game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at) VALUES
(3, 1, 11, 7, 1, 0, DATE_SUB(NOW(), INTERVAL 8 MINUTE)); -- Rosa en Río

-- Jugador 3 ha colocado 1 dinosaurio
INSERT INTO placement (placement_id, game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at) VALUES
(4, 1, 14, 2, 2, 0, DATE_SUB(NOW(), INTERVAL 9 MINUTE)); -- Rojo en Parado Diferencia

-- Jugador 4 ha colocado 1 dinosaurio
INSERT INTO placement (placement_id, game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at) VALUES
(5, 1, 24, 7, 3, 0, DATE_SUB(NOW(), INTERVAL 7 MINUTE)); -- Naranja en Río

-- Jugador 5 ha colocado 1 dinosaurio
INSERT INTO placement (placement_id, game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at) VALUES
(6, 1, 25, 3, 4, 0, DATE_SUB(NOW(), INTERVAL 6 MINUTE)); -- Amarillo en Pradera del Amor

-- Registrar tiradas de dado
INSERT INTO placement_die_rolls (roll_id, game_id, affected_player_seat, die_face, created_at) VALUES
(1, 1, 0, 'EMPTY', DATE_SUB(NOW(), INTERVAL 15 MINUTE)),     -- Primera tirada (player 1)
(2, 1, 1, 'FOREST', DATE_SUB(NOW(), INTERVAL 12 MINUTE)),    -- Segunda tirada (player 2)
(3, 1, 0, 'LEFT_SIDE', DATE_SUB(NOW(), INTERVAL 7 MINUTE));  -- Tercera tirada (player 1 actual)

-- ========================================
-- PARTIDAS COMPLETADAS PARA HISTORIAL
-- ========================================

-- PARTIDA 1: Player6 vs Player5 - Player6 GANA (27-12)
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, created_at, finished_at, current_round, current_turn, active_seat)
VALUES (100, 'COMPLETED', 6, 5, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), 2, 12, 0);

-- Bolsas para partida 100
INSERT INTO bags (game_id, user_id) VALUES (100, 6), (100, 5);
SET @bag_100_1 = LAST_INSERT_ID() - 1;
SET @bag_100_2 = LAST_INSERT_ID();

-- Dinosaurios jugador 6 (ganador)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_100_1, 1, 1), (@bag_100_1, 1, 1), (@bag_100_1, 1, 1), -- 3 amarillos
(@bag_100_1, 2, 1), (@bag_100_1, 3, 1), (@bag_100_1, 4, 1), -- 3 diferentes
(@bag_100_1, 5, 1), (@bag_100_1, 5, 1), -- 2 rosas
(@bag_100_1, 6, 1), (@bag_100_1, 2, 1), (@bag_100_1, 3, 1), (@bag_100_1, 4, 1); -- resto

SET @dino_start = LAST_INSERT_ID() - 11;

-- Dinosaurios jugador 5 (perdedor)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_100_2, 2, 1), (@bag_100_2, 3, 1), -- 2 diferentes en bosque
(@bag_100_2, 1, 1), (@bag_100_2, 4, 1), -- 2 en prado
(@bag_100_2, 5, 1), (@bag_100_2, 5, 1), (@bag_100_2, 6, 1), -- 3 en pradera
(@bag_100_2, 1, 1), (@bag_100_2, 2, 1), (@bag_100_2, 3, 1), (@bag_100_2, 4, 1), (@bag_100_2, 6, 1); -- río

-- Colocaciones jugador 6 (player_seat 0)
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(100, 0, @dino_start, 1, 0), (100, 0, @dino_start + 1, 1, 1), (100, 0, @dino_start + 2, 1, 2), -- Bosque 3 amarillos
(100, 0, @dino_start + 3, 2, 0), (100, 0, @dino_start + 4, 2, 1), (100, 0, @dino_start + 5, 2, 2), -- Prado diferentes
(100, 0, @dino_start + 6, 3, 0), (100, 0, @dino_start + 7, 3, 1), -- Pradera 2 rosas
(100, 0, @dino_start + 8, 4, 0), (100, 0, @dino_start + 9, 4, 1), (100, 0, @dino_start + 10, 4, 2), -- Trío
(100, 0, @dino_start + 11, 7, 0); -- Río

-- Colocaciones jugador 5 (player_seat 1)
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(100, 1, @dino_start + 12, 1, 0), (100, 1, @dino_start + 13, 1, 1), -- Bosque 2 diferentes
(100, 1, @dino_start + 14, 2, 0), (100, 1, @dino_start + 15, 2, 1), -- Prado
(100, 1, @dino_start + 16, 3, 0), (100, 1, @dino_start + 17, 3, 1), (100, 1, @dino_start + 18, 3, 2), -- Pradera
(100, 1, @dino_start + 19, 7, 0), (100, 1, @dino_start + 20, 7, 1), (100, 1, @dino_start + 21, 7, 2), (100, 1, @dino_start + 22, 7, 3), -- Río
(100, 1, @dino_start + 23, 4, 0); -- Trío incompleto

-- Puntajes finales partida 100
INSERT INTO final_score (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count) VALUES
(100, 0, 27, 1, 0, 0), -- Player6 gana
(100, 1, 12, 4, 0, 0); -- Player5 pierde

-- Sala para partida 100
INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status, game_id) 
VALUES ('TEST100', 6, 2, 'clockwise', 'primavera', 'COMPLETED', 100);

-- PARTIDA 2: Player6 vs Player2 - Player2 GANA (35-30) - Player6 PIERDE
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, created_at, finished_at, current_round, current_turn, active_seat)
VALUES (101, 'COMPLETED', 6, 2, DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR), 2, 12, 1);

-- Bolsas para partida 101
INSERT INTO bags (game_id, user_id) VALUES (101, 6), (101, 2);
SET @bag_101_1 = LAST_INSERT_ID() - 1;
SET @bag_101_2 = LAST_INSERT_ID();

-- Dinosaurios jugador 6 (perdedor)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_101_1, 1, 1), (@bag_101_1, 2, 1), (@bag_101_1, 3, 1), (@bag_101_1, 4, 1),
(@bag_101_1, 5, 1), (@bag_101_1, 6, 1), (@bag_101_1, 1, 1), (@bag_101_1, 2, 1),
(@bag_101_1, 3, 1), (@bag_101_1, 4, 1), (@bag_101_1, 5, 1), (@bag_101_1, 6, 1);

SET @dino_start = LAST_INSERT_ID() - 11;

-- Dinosaurios jugador 2 (ganador)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_101_2, 1, 1), (@bag_101_2, 1, 1), (@bag_101_2, 2, 1), (@bag_101_2, 2, 1),
(@bag_101_2, 3, 1), (@bag_101_2, 3, 1), (@bag_101_2, 4, 1), (@bag_101_2, 5, 1),
(@bag_101_2, 6, 1), (@bag_101_2, 1, 1), (@bag_101_2, 2, 1), (@bag_101_2, 3, 1);

-- Colocaciones jugador 6 (player_seat 0) - 30 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(101, 0, @dino_start, 1, 0), (101, 0, @dino_start + 1, 1, 1), (101, 0, @dino_start + 2, 1, 2), -- Bosque
(101, 0, @dino_start + 3, 2, 0), (101, 0, @dino_start + 4, 2, 1), (101, 0, @dino_start + 5, 2, 2), -- Prado
(101, 0, @dino_start + 6, 3, 0), (101, 0, @dino_start + 7, 3, 1), -- Pradera
(101, 0, @dino_start + 8, 4, 0), (101, 0, @dino_start + 9, 4, 1), (101, 0, @dino_start + 10, 4, 2), -- Trío
(101, 0, @dino_start + 11, 7, 0); -- Río

-- Colocaciones jugador 2 (player_seat 1) - 35 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(101, 1, @dino_start + 12, 1, 0), (101, 1, @dino_start + 13, 1, 1), (101, 1, @dino_start + 14, 1, 2), -- Bosque
(101, 1, @dino_start + 15, 2, 0), (101, 1, @dino_start + 16, 2, 1), (101, 1, @dino_start + 17, 2, 2), -- Prado
(101, 1, @dino_start + 18, 3, 0), (101, 1, @dino_start + 19, 3, 1), (101, 1, @dino_start + 20, 3, 2), -- Pradera
(101, 1, @dino_start + 21, 4, 0), (101, 1, @dino_start + 22, 4, 1), (101, 1, @dino_start + 23, 4, 2), -- Trío
(101, 1, @dino_start + 24, 7, 0); -- Río

-- Puntajes finales partida 101
INSERT INTO final_score (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count) VALUES
(101, 0, 30, 1, 2, 1), -- Player6 pierde
(101, 1, 35, 1, 3, 2); -- Player2 gana

-- Sala para partida 101
INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status, game_id) 
VALUES ('TEST101', 6, 2, 'clockwise', 'primavera', 'COMPLETED', 101);

-- PARTIDA 3: Player6 vs Player3 - Player6 GANA (42-38)
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, created_at, finished_at, current_round, current_turn, active_seat)
VALUES (102, 'COMPLETED', 6, 3, DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 5 HOUR), 2, 12, 0);

-- Bolsas para partida 102
INSERT INTO bags (game_id, user_id) VALUES (102, 6), (102, 3);
SET @bag_102_1 = LAST_INSERT_ID() - 1;
SET @bag_102_2 = LAST_INSERT_ID();

-- Dinosaurios jugador 6 (ganador)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_102_1, 1, 1), (@bag_102_1, 1, 1), (@bag_102_1, 1, 1), (@bag_102_1, 1, 1),
(@bag_102_1, 2, 1), (@bag_102_1, 3, 1), (@bag_102_1, 4, 1), (@bag_102_1, 5, 1),
(@bag_102_1, 6, 1), (@bag_102_1, 2, 1), (@bag_102_1, 3, 1), (@bag_102_1, 4, 1);

SET @dino_start = LAST_INSERT_ID() - 11;

-- Dinosaurios jugador 3
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_102_2, 1, 1), (@bag_102_2, 2, 1), (@bag_102_2, 3, 1), (@bag_102_2, 4, 1),
(@bag_102_2, 5, 1), (@bag_102_2, 6, 1), (@bag_102_2, 1, 1), (@bag_102_2, 2, 1),
(@bag_102_2, 3, 1), (@bag_102_2, 4, 1), (@bag_102_2, 5, 1), (@bag_102_2, 6, 1);

-- Colocaciones jugador 6 (player_seat 0) - 42 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(102, 0, @dino_start, 1, 0), (102, 0, @dino_start + 1, 1, 1), (102, 0, @dino_start + 2, 1, 2), (102, 0, @dino_start + 3, 1, 3), -- Bosque 4 amarillos
(102, 0, @dino_start + 4, 2, 0), (102, 0, @dino_start + 5, 2, 1), (102, 0, @dino_start + 6, 2, 2), -- Prado
(102, 0, @dino_start + 7, 3, 0), (102, 0, @dino_start + 8, 3, 1), -- Pradera
(102, 0, @dino_start + 9, 4, 0), (102, 0, @dino_start + 10, 4, 1), (102, 0, @dino_start + 11, 4, 2), -- Trío
(102, 0, @dino_start + 12, 7, 0); -- Río

-- Colocaciones jugador 3 (player_seat 1) - 38 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(102, 1, @dino_start + 13, 1, 0), (102, 1, @dino_start + 14, 1, 1), (102, 1, @dino_start + 15, 1, 2), -- Bosque
(102, 1, @dino_start + 16, 2, 0), (102, 1, @dino_start + 17, 2, 1), (102, 1, @dino_start + 18, 2, 2), -- Prado
(102, 1, @dino_start + 19, 3, 0), (102, 1, @dino_start + 20, 3, 1), (102, 1, @dino_start + 21, 3, 2), -- Pradera
(102, 1, @dino_start + 22, 4, 0), (102, 1, @dino_start + 23, 4, 1), (102, 1, @dino_start + 24, 4, 2); -- Trío

-- Puntajes finales partida 102
INSERT INTO final_score (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count) VALUES
(102, 0, 42, 1, 4, 2), -- Player6 gana
(102, 1, 38, 0, 5, 2); -- Player3 pierde

-- Sala para partida 102
INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status, game_id) 
VALUES ('TEST102', 6, 2, 'clockwise', 'verano', 'COMPLETED', 102);

-- PARTIDA 4: Player6 vs Player4 - EMPATE (33-33)
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, created_at, finished_at, current_round, current_turn, active_seat)
VALUES (103, 'COMPLETED', 6, 4, DATE_SUB(NOW(), INTERVAL 8 HOUR), DATE_SUB(NOW(), INTERVAL 7 HOUR), 2, 12, 0);

-- Bolsas para partida 103
INSERT INTO bags (game_id, user_id) VALUES (103, 6), (103, 4);
SET @bag_103_1 = LAST_INSERT_ID() - 1;
SET @bag_103_2 = LAST_INSERT_ID();

-- Dinosaurios jugador 6
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_103_1, 1, 1), (@bag_103_1, 1, 1), (@bag_103_1, 2, 1), (@bag_103_1, 3, 1),
(@bag_103_1, 4, 1), (@bag_103_1, 5, 1), (@bag_103_1, 6, 1), (@bag_103_1, 1, 1),
(@bag_103_1, 2, 1), (@bag_103_1, 3, 1), (@bag_103_1, 4, 1), (@bag_103_1, 5, 1);

SET @dino_start = LAST_INSERT_ID() - 11;

-- Dinosaurios jugador 4
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_103_2, 1, 1), (@bag_103_2, 2, 1), (@bag_103_2, 2, 1), (@bag_103_2, 3, 1),
(@bag_103_2, 4, 1), (@bag_103_2, 5, 1), (@bag_103_2, 6, 1), (@bag_103_2, 1, 1),
(@bag_103_2, 2, 1), (@bag_103_2, 3, 1), (@bag_103_2, 4, 1), (@bag_103_2, 5, 1);

-- Colocaciones jugador 6 (player_seat 0) - 33 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(103, 0, @dino_start, 1, 0), (103, 0, @dino_start + 1, 1, 1), (103, 0, @dino_start + 2, 1, 2), -- Bosque
(103, 0, @dino_start + 3, 2, 0), (103, 0, @dino_start + 4, 2, 1), (103, 0, @dino_start + 5, 2, 2), -- Prado
(103, 0, @dino_start + 6, 3, 0), (103, 0, @dino_start + 7, 3, 1), -- Pradera
(103, 0, @dino_start + 8, 4, 0), (103, 0, @dino_start + 9, 4, 1), (103, 0, @dino_start + 10, 4, 2), -- Trío
(103, 0, @dino_start + 11, 7, 0); -- Río

-- Colocaciones jugador 4 (player_seat 1) - 33 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(103, 1, @dino_start + 12, 1, 0), (103, 1, @dino_start + 13, 1, 1), (103, 1, @dino_start + 14, 1, 2), -- Bosque
(103, 1, @dino_start + 15, 2, 0), (103, 1, @dino_start + 16, 2, 1), (103, 1, @dino_start + 17, 2, 2), -- Prado
(103, 1, @dino_start + 18, 3, 0), (103, 1, @dino_start + 19, 3, 1), -- Pradera
(103, 1, @dino_start + 20, 4, 0), (103, 1, @dino_start + 21, 4, 1), (103, 1, @dino_start + 22, 4, 2), -- Trío
(103, 1, @dino_start + 23, 7, 0); -- Río

-- Puntajes finales partida 103 - EMPATE
INSERT INTO final_score (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count) VALUES
(103, 0, 33, 1, 2, 1), -- Player6 empata
(103, 1, 33, 1, 2, 1); -- Player4 empata

-- Sala para partida 103
INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status, game_id) 
VALUES ('TEST103', 6, 2, 'clockwise', 'primavera', 'COMPLETED', 103);

-- PARTIDA 5: Player6 vs Player1 - Player1 GANA (40-28) - Player6 PIERDE
INSERT INTO games (game_id, status, player1_user_id, player2_user_id, created_at, finished_at, current_round, current_turn, active_seat)
VALUES (104, 'COMPLETED', 1, 6, DATE_SUB(NOW(), INTERVAL 10 HOUR), DATE_SUB(NOW(), INTERVAL 9 HOUR), 2, 12, 0);

-- Bolsas para partida 104
INSERT INTO bags (game_id, user_id) VALUES (104, 1), (104, 6);
SET @bag_104_1 = LAST_INSERT_ID() - 1;
SET @bag_104_2 = LAST_INSERT_ID();

-- Dinosaurios jugador 1 (ganador)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_104_1, 1, 1), (@bag_104_1, 1, 1), (@bag_104_1, 2, 1), (@bag_104_1, 2, 1),
(@bag_104_1, 3, 1), (@bag_104_1, 4, 1), (@bag_104_1, 5, 1), (@bag_104_1, 6, 1),
(@bag_104_1, 1, 1), (@bag_104_1, 2, 1), (@bag_104_1, 3, 1), (@bag_104_1, 4, 1);

SET @dino_start = LAST_INSERT_ID() - 11;

-- Dinosaurios jugador 6 (perdedor)
INSERT INTO bag_contents (bag_id, species_id, is_played) VALUES 
(@bag_104_2, 1, 1), (@bag_104_2, 2, 1), (@bag_104_2, 3, 1), (@bag_104_2, 4, 1),
(@bag_104_2, 5, 1), (@bag_104_2, 6, 1), (@bag_104_2, 1, 1), (@bag_104_2, 2, 1),
(@bag_104_2, 3, 1), (@bag_104_2, 4, 1), (@bag_104_2, 5, 1), (@bag_104_2, 6, 1);

-- Colocaciones jugador 1 (player_seat 0) - 40 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(104, 0, @dino_start, 1, 0), (104, 0, @dino_start + 1, 1, 1), (104, 0, @dino_start + 2, 1, 2), (104, 0, @dino_start + 3, 1, 3), -- Bosque
(104, 0, @dino_start + 4, 2, 0), (104, 0, @dino_start + 5, 2, 1), (104, 0, @dino_start + 6, 2, 2), -- Prado
(104, 0, @dino_start + 7, 3, 0), (104, 0, @dino_start + 8, 3, 1), -- Pradera
(104, 0, @dino_start + 9, 4, 0), (104, 0, @dino_start + 10, 4, 1), (104, 0, @dino_start + 11, 4, 2); -- Trío

-- Colocaciones jugador 6 (player_seat 1) - 28 puntos
INSERT INTO placement (game_id, player_seat, dino_id, enclosures_id, slot_index) VALUES
(104, 1, @dino_start + 12, 1, 0), (104, 1, @dino_start + 13, 1, 1), -- Bosque
(104, 1, @dino_start + 14, 2, 0), (104, 1, @dino_start + 15, 2, 1), (104, 1, @dino_start + 16, 2, 2), -- Prado
(104, 1, @dino_start + 17, 3, 0), (104, 1, @dino_start + 18, 3, 1), (104, 1, @dino_start + 19, 3, 2), -- Pradera
(104, 1, @dino_start + 20, 7, 0), (104, 1, @dino_start + 21, 7, 1), (104, 1, @dino_start + 22, 7, 2), -- Río
(104, 1, @dino_start + 23, 4, 0); -- Trío incompleto

-- Puntajes finales partida 104
INSERT INTO final_score (game_id, player_seat, total_points, river_points, trex_bonus_points, tiebreaker_trex_count) VALUES
(104, 0, 40, 0, 6, 3), -- Player1 gana
(104, 1, 28, 3, 1, 1); -- Player6 pierde

-- Sala para partida 104
INSERT INTO rooms (room_code, admin_user_id, max_players, game_direction, board_type, status, game_id) 
VALUES ('TEST104', 1, 2, 'clockwise', 'verano', 'COMPLETED', 104);

-- Procedimiento almacenado para colocar un dinosaurio
DELIMITER $$
DROP PROCEDURE IF EXISTS place_dinosaur$$
CREATE PROCEDURE place_dinosaur(
    IN game_id_param BIGINT,
    IN dino_id_param BIGINT,
    IN enclosure_id_param BIGINT,
    IN player_seat_param TINYINT,
    OUT success BOOLEAN
)
BEGIN
    DECLARE slot_index_value TINYINT;
    DECLARE dino_exists BOOLEAN DEFAULT FALSE;
    
    -- Verificar que el dinosaurio existe y pertenece a la bolsa del jugador
    SELECT TRUE INTO dino_exists
    FROM bag_contents bc
    JOIN bags b ON bc.bag_id = b.bag_id
    WHERE bc.bag_content_id = dino_id_param 
      AND b.game_id = game_id_param
      AND bc.is_played = 0;
    
    -- Si el dinosaurio existe y está disponible
    IF dino_exists THEN
        -- Calcular el siguiente índice de slot disponible
        SELECT IFNULL(MAX(slot_index) + 1, 0) INTO slot_index_value
        FROM placement
        WHERE game_id = game_id_param 
          AND player_seat = player_seat_param 
          AND enclosures_id = enclosure_id_param;
        
        -- Insertar la colocación
        INSERT INTO placement (game_id, dino_id, enclosures_id, player_seat, slot_index, placed_at)
        VALUES (game_id_param, dino_id_param, enclosure_id_param, player_seat_param, slot_index_value, NOW());
        
        -- Marcar el dinosaurio como jugado
        UPDATE bag_contents SET is_played = 1 WHERE bag_content_id = dino_id_param;
        
        -- Incrementar el turno actual del juego
        UPDATE games SET current_turn = current_turn + 1 WHERE game_id = game_id_param;
        
        SET success = TRUE;
    ELSE
        SET success = FALSE;
    END IF;
END$$
DELIMITER ;

-- Procedimiento almacenado para obtener el estado completo del juego (actualizado para 5 jugadores)
DELIMITER //
DROP PROCEDURE IF EXISTS get_game_state//
CREATE PROCEDURE get_game_state(IN game_id_param BIGINT)
BEGIN
    -- Información básica del juego
    SELECT 
        g.game_id, 
        g.status, 
        g.player1_user_id, 
        g.player2_user_id,
        g.player3_user_id,
        g.player4_user_id,
        g.player5_user_id,
        u1.username AS player1_username, 
        u2.username AS player2_username,
        u3.username AS player3_username,
        u4.username AS player4_username,
        u5.username AS player5_username,
        g.current_round,
        g.current_turn,
        g.active_seat,
        UNIX_TIMESTAMP(g.turn_started_at) AS turn_started_at_unix
    FROM 
        games g
    LEFT JOIN users u1 ON g.player1_user_id = u1.user_id
    LEFT JOIN users u2 ON g.player2_user_id = u2.user_id
    LEFT JOIN users u3 ON g.player3_user_id = u3.user_id
    LEFT JOIN users u4 ON g.player4_user_id = u4.user_id
    LEFT JOIN users u5 ON g.player5_user_id = u5.user_id
    WHERE 
        g.game_id = game_id_param;
    
    -- Dinosaurios en bolsas de jugadores
    SELECT 
        b.user_id,
        bc.bag_content_id,
        bc.species_id AS dino_type,
        s.code AS dino_code,
        bc.is_played
    FROM 
        bags b
    JOIN bag_contents bc ON b.bag_id = bc.bag_id
    JOIN species s ON bc.species_id = s.species_id
    WHERE 
        b.game_id = game_id_param;
    
    -- Colocaciones en recintos
    SELECT 
        e.enclosures_id,
        e.name_enclosures AS name,
        e.special_rule,
        p.placement_id,
        p.player_seat,
        p.slot_index,
        bc.species_id AS dino_type,
        s.code AS dino_code
    FROM 
        enclosures e
    LEFT JOIN placement p ON e.enclosures_id = p.enclosures_id AND p.game_id = game_id_param
    LEFT JOIN bag_contents bc ON p.dino_id = bc.bag_content_id
    LEFT JOIN species s ON bc.species_id = s.species_id;
    
    -- Última tirada de dado
    SELECT 
        r.roll_id,
        r.affected_player_seat,
        r.die_face,
        UNIX_TIMESTAMP(r.created_at) AS roll_time
    FROM 
        placement_die_rolls r
    WHERE 
        r.game_id = game_id_param
    ORDER BY 
        r.created_at DESC
    LIMIT 1;
END//
DELIMITER ;