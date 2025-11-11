import { obtenerIdUsuario, obtenerNombreUsuario, cerrarSesion, PAGES } from "./auth.js";
import ApiConfig from "./api-config.js";

const getApiBase = () => window.getApiBase ? window.getApiBase() : "http://localhost:8000";
const MAX_ROUNDS = 2;
const POLLING_INTERVAL = 3000;

function getTurnsPerRound() {
  return state.totalPlayers * 6;
}

const DICE_CONFIG = {
  bosque: { 
    probability: 16.67, 
    icon: 'fa-tree', 
    text: 'Árboles Comunes', 
    areas: ['bosque'],
    description: 'Los demás jugadores deben colocar en el área de Bosque (Árboles Comunes)'
  },
  llanura: { 
    probability: 16.67, 
    icon: 'fa-seedling', 
    text: 'Manzanos', 
    areas: ['llanura'],
    description: 'Los demás jugadores deben colocar en el área de Llanura (Manzanos)'
  },
  banos: { 
    probability: 16.67, 
    icon: 'fa-restroom', 
    text: 'Baños', 
    sides: ['derecha'],
    description: 'Los demás jugadores deben colocar en el lado derecho (Baños)'
  },
  cafeteria: { 
    probability: 25, 
    icon: 'fa-coffee', 
    text: 'Cafeterías', 
    sides: ['izquierda'],
    description: 'Los demás jugadores deben colocar en el lado izquierdo (Cafeterías)'
  },
  vacio: { 
    probability: 16.67, 
    icon: 'fa-box-open', 
    text: 'Recinto Vacío', 
    requireEmpty: true,
    description: 'Los demás jugadores deben colocar en un recinto vacío'
  },
  'no-trex': { 
    probability: 8.33, 
    icon: 'fa-ban', 
    text: 'Sin T-Rex', 
    forbiddenType: 'rojo',
    description: 'Los demás jugadores no pueden colocar donde ya hay un T-Rex (rojo)'
  }
};

const ENCLOSURE_CONTAINER_TO_ID = {
  dinos__igual: 1,
  dinos__noigual: 2,
  dinos__pareja: 3,
  dinos__tres: 4,
  dinos__rey: 5,
  dinos__solo: 6,
  dinos__rio: 7,
};

function isMultiplayerMode() {
  return state.totalPlayers === 2 && state.playerSeat !== null && state.playerSeat !== undefined;
}

const state = {
  gameId: null,
  playerSeat: 0,
  viewingBoardOf: 0,
  enclosuresMax: {},
  isPlacing: false,
  activeSeat: null,
  
  totalPlayers: 2,
  gameDirection: 'clockwise',
  playerNames: {},
  
  currentDice: null,
  diceRolled: false,
  diceRolledBySeat: null,
  diceRollPending: false, // Flag para indicar que se acaba de lanzar el dado y está pendiente de confirmación del backend
  diceRollTimestamp: null, // Timestamp del último lanzamiento del dado
  
  timeLeft: 60,
  timer: null,
  
  pollingInterval: null,
  lastKnownTurn: 0,
  lastKnownActiveSeat: null,
  isPolling: false,
  
  placedThisTurn: false,
  
  playerScores: {},
  
  isReloading: false,
  dropHandlers: [],
};

function applyBoardTheme(boardType) {
  const gameBoard = document.getElementById('gameBoard');
  if (!gameBoard) {
    console.warn('[boardTheme] No se encontró el tablero');
    return;
  }
  
  const boardConfig = {
    'primavera': {
      image: './img/tableroprimavera.jpg',
      class: 'spring-board'
    },
    'verano': {
      image: './img/tableroverano.jpg',
      class: 'summer-board'
    }
  };
  
  const config = boardConfig[boardType] || boardConfig['primavera'];
  
  gameBoard.classList.remove('spring-board', 'summer-board');
  gameBoard.classList.add(config.class);
  gameBoard.style.backgroundImage = `url('${config.image}')`;
  
  console.log('[boardTheme] ✅ Tablero cambiado a:', boardType, '| Clase:', config.class, '| Imagen:', config.image);
}

function createLoadingOverlay() {
  let overlay = document.getElementById("loading-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "loading-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
    display: none; align-items: center; justify-content: center; z-index: 9999;
  `;
  const box = document.createElement("div");
  box.style.cssText = `
    background: white; padding: 30px; border-radius: 12px; 
    box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center;
  `;
  box.id = "loading-overlay-text";
  box.innerHTML = '<div class="spinner"></div><p style="margin-top: 15px; color: #333;">CARGANDO...</p>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return overlay;
}

function showLoading(msg = "CARGANDO...", ms = 500) {
  const overlay = createLoadingOverlay();
  const box = document.getElementById("loading-overlay-text");
  if (box) box.querySelector('p').textContent = msg;
  overlay.style.display = "flex";
  return new Promise((res) => setTimeout(() => res(), ms));
}

function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = "none";
}

async function fetchJSON(url, options = {}) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return resp.json();
}

function imageForHorizontal(color) {
  return `./img/${color}Hori.PNG`;
}

function imageForVertical(color) {
  return `./img/${color}Verti.PNG`;
}

function getInternalName(zoneType) {
  const mapping = {
    'forest-same': 'igual',
    'prairie-diff': 'noigual',
    'love-prairie': 'pareja',
    'trio': 'tres',
    'king': 'rey',
    'island': 'solo',
    'river': 'rio'
  };
  return mapping[zoneType] || zoneType;
}

// ===========================
// SISTEMA DE NOTIFICACIONES
// ===========================

function showNotification(message, type = "info") {
  const container = document.getElementById('notification-container') || createNotificationContainer();
  
  container.innerHTML = '';
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas ${getIconForType(type)}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Duración más larga para mensajes de error (7 segundos) para personas mayores
  const duration = type === 'error' ? 7000 : 4000;
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
  
  if (type === 'success' || type === 'warning' || type === 'error') {
    playNotificationSound();
  }
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notification-container';
  container.style.cssText = `
    position: fixed; top: 100px; right: 20px; z-index: 10000;
    display: flex; flex-direction: column; gap: 10px;
    max-width: 350px;
  `;
  document.body.appendChild(container);
  return container;
}

function getIconForType(type) {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  return icons[type] || icons.info;
}

function playNotificationSound() {
  // Archivo de sonido no existe, función deshabilitada
  // try {
  //   const audio = new Audio('./sounds/notification.mp3');
  //   audio.volume = 0.5;
  //   audio.play().catch(() => {});
  // } catch (e) {}
}

// ===========================
// SISTEMA DE DADO
// ===========================

function rollDice() {
  const isMultiplayer = isMultiplayerMode();
  
  if (isMultiplayer) {
    if (state.playerSeat !== state.activeSeat) {
      const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
      console.log("[dice] No es tu turno. En modo multiplayer solo puedes tirar el dado cuando es tu turno.");
      console.log("[dice] playerSeat:", state.playerSeat, "activeSeat:", state.activeSeat);
      showNotification(`⏳ No es tu turno. Es el turno de ${activePlayerName}. Espera tu turno.`, "warning");
      return;
    }
  } else {
    if (state.viewingBoardOf !== state.activeSeat) {
      const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
      console.log("[dice] No puedes tirar el dado. Estás viendo el tablero de otro jugador.");
      showNotification(`⏳ Debes ver el tablero de ${activePlayerName} para tirar el dado.`, "warning");
      return;
    }
  }
  
  if (state.diceRolled && state.diceRolledBySeat === state.activeSeat) {
    console.log("[dice] Este jugador ya lanzó el dado en este turno");
    showNotification("Ya lanzaste el dado en este turno", "warning");
    return;
  }
  
  if (state.diceRolled && state.diceRolledBySeat !== state.activeSeat) {
    console.log("[dice] Reemplazando dado del turno anterior (jugador", state.diceRolledBySeat, ") con nuevo dado del jugador activo (", state.activeSeat, ")");
  }

  // RNF57: Probabilidades correctas del dado
  // Mejorar aleatoriedad usando múltiples fuentes
  const random1 = Math.random();
  const random2 = Math.random();
  const random3 = Math.random();
  // Combinar múltiples números aleatorios para mayor aleatoriedad
  const combinedRandom = ((random1 + random2 + random3) / 3) * 100;
  const random = combinedRandom;
  
  let cumulative = 0;
  let selectedFace = null;
  
  // Convertir objeto a array para garantizar orden consistente
  const diceFaces = Object.entries(DICE_CONFIG);
  
  for (const [face, config] of diceFaces) {
    cumulative += config.probability;
    if (random <= cumulative) {
      selectedFace = face;
      break;
    }
  }
  
  // Fallback: si por alguna razón no se seleccionó, usar el primero
  if (!selectedFace) {
    selectedFace = diceFaces[0][0];
  }
  
  state.currentDice = selectedFace;
  
  console.log('[dice] Resultado aleatorio:', {
    random1: random1.toFixed(4),
    random2: random2.toFixed(4),
    random3: random3.toFixed(4),
    combinedRandom: combinedRandom.toFixed(4),
    selectedFace: selectedFace,
    timestamp: Date.now()
  });
  
  // Mapear cara del dado del frontend al backend
  const diceFaceMapping = {
    'bosque': 'FOREST',        // RF34: Árboles Comunes
    'llanura': 'ROCKS',        // RF35: Manzanos (ROCKS en backend representa área inferior)
    'banos': 'RIGHT_SIDE',     // RF36: Baños (lado derecho)
    'cafeteria': 'LEFT_SIDE',  // RF37: Cafeterías (lado izquierdo)
    'vacio': 'EMPTY',          // RF38: Recinto Vacío
    'no-trex': 'NO_TREX'       // RF39: Recinto sin T-REX
  };
  
  const backendDieFace = diceFaceMapping[state.currentDice] || 'FOREST';
  
  state.diceRollPending = true;
  state.diceRollTimestamp = Date.now();
  
  (async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/game/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          game_id: state.gameId,
          roller_seat: state.activeSeat,
          affected_seat: state.activeSeat,
          die_face: backendDieFace
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[dice] Dado enviado al backend, roll_id:', data.roll_id);
        setTimeout(() => {
          if (state.diceRollPending) {
            console.log('[dice] Timeout de confirmación alcanzado, pero manteniendo como pendiente hasta que el polling confirme');
          }
        }, 3000);
      } else {
        console.error('[dice] Error al enviar dado al backend:', data.error);
        setTimeout(() => {
          state.diceRollPending = false;
        }, 5000);
      }
    } catch (error) {
      console.error('[dice] Error al comunicarse con el backend:', error);
      setTimeout(() => {
        state.diceRollPending = false;
      }, 5000);
    }
  })();
  
  state.diceRolled = true;
  state.diceRolledBySeat = state.activeSeat;
  
  updateDiceDisplay();
  highlightValidZones();
  updateDiceButtonVisibility();
  
  const playerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
  showNotification(
    `🎲 ${playerName} LANZÓ: ${DICE_CONFIG[state.currentDice].text}. TODOS DEBEN CUMPLIR ESTA RESTRICCIÓN!`, 
    'success'
  );
  
  console.log('[dice] Estado después de lanzar:', {
    diceRolled: state.diceRolled,
    diceRolledBySeat: state.diceRolledBySeat,
    activeSeat: state.activeSeat,
    currentDice: state.currentDice,
    backendDieFace: backendDieFace
  });
}

function updateDiceDisplay() {
  if (!state.currentDice) {
    console.log('[dice] No hay dado para mostrar');
    return;
  }
  
  const config = DICE_CONFIG[state.currentDice];
  const dieContainer = document.getElementById('die-container');
  const dieFace = document.getElementById('die-face');
  const dieText = document.getElementById('die-text');
  const dieDescription = document.getElementById('die-description');
  const dieAffectedPlayers = document.getElementById('die-affected-players');
  
  if (!dieContainer) {
    console.error('[dice] No se encontró el contenedor del dado');
    return;
  }
  
  if (dieFace && dieText && dieDescription) {
    // Mostrar primero para calcular dimensiones
    dieContainer.style.display = 'flex';
    dieContainer.style.opacity = '0';
    dieContainer.style.visibility = 'hidden';
    
    // Posicionar el contenedor del dado debajo del player-bag
    const playerBag = document.getElementById('player-bag');
    if (playerBag) {
      const bagRect = playerBag.getBoundingClientRect();
      // Forzar reflow para obtener dimensiones correctas
      void dieContainer.offsetWidth;
      const containerRect = dieContainer.getBoundingClientRect();
      
      // Calcular posición: centrado horizontalmente respecto al bag, debajo de él
      const left = bagRect.left + (bagRect.width / 2) - (containerRect.width / 2);
      const top = bagRect.bottom + 20; // 20px de espacio debajo del bag
      
      dieContainer.style.left = `${left}px`;
      dieContainer.style.top = `${top}px`;
      dieContainer.style.transform = 'translateY(20px)';
      dieContainer.style.visibility = 'visible';
    }
    
    // Forzar reflow para que la animación funcione
    void dieContainer.offsetWidth;
    
    // Aplicar animación
    requestAnimationFrame(() => {
      dieContainer.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      dieContainer.style.opacity = '1';
      dieContainer.style.transform = 'translateY(0)';
    });
    
    dieText.innerHTML = `<i class="fas ${config.icon}"></i> ${config.text}`;
    dieDescription.textContent = config.description;
    
    // Mostrar claramente quién tiró el dado y que todos deben cumplir la restricción
    if (dieAffectedPlayers) {
      const rollerName = state.playerNames[state.diceRolledBySeat] || `JUGADOR ${state.diceRolledBySeat + 1}`;
      const isActivePlayer = state.activeSeat === state.diceRolledBySeat;
      
      if (isActivePlayer) {
        // El jugador activo tiró el dado
        dieAffectedPlayers.innerHTML = `🎲 <strong>TÚ TIRASTE EL DADO</strong>, DEBES CUMPLIR LA RESTRICCIÓN`;
        dieAffectedPlayers.style.color = '#ffc107';
      } else {
        // Otro tiró el dado
        dieAffectedPlayers.innerHTML = `⚠️ <strong>${rollerName}</strong> TIRÓ EL DADO, TÚ DEBES CUMPLIR LA RESTRICCIÓN`;
        dieAffectedPlayers.style.color = '#dc3545';
      }
    }
    
    dieFace.classList.add('dice-rolled');
    setTimeout(() => dieFace.classList.remove('dice-rolled'), 500);
    
    // Recalcular posición después de que el contenido se renderice
    setTimeout(() => {
      if (playerBag && dieContainer.style.display !== 'none') {
        const bagRect = playerBag.getBoundingClientRect();
        const containerRect = dieContainer.getBoundingClientRect();
        const left = bagRect.left + (bagRect.width / 2) - (containerRect.width / 2);
        const top = bagRect.bottom + 20;
        dieContainer.style.left = `${left}px`;
        dieContainer.style.top = `${top}px`;
      }
    }, 10);
  }
}

function resetDice() {
  console.log('[resetDice] Reseteando estado del dado...');
  state.currentDice = null;
  state.diceRolled = false;
  state.diceRolledBySeat = null;
  state.diceRollPending = false;
  state.diceRollTimestamp = null;
  state.placedThisTurn = false;
  
  // Ocultar el contenedor del dado y limpiar estilos
  const dieContainer = document.getElementById('die-container');
  if (dieContainer) {
    dieContainer.style.display = 'none';
    dieContainer.style.opacity = '';
    dieContainer.style.transform = '';
    dieContainer.style.transition = '';
    dieContainer.style.visibility = '';
    dieContainer.style.left = '';
    dieContainer.style.top = '';
  }
  
  // Actualizar visibilidad del botón del dado
  updateDiceButtonVisibility();
  
  setupDiceButton();
  
  console.log('[resetDice] ✅ Estado del dado reseteado correctamente');
}

function isValidPlacement(zone, dinoType) {
  const slot = zone.dataset.slot;
  const zoneType = zone.dataset.zone;
  const innerId = `dinos__${getInternalName(zoneType)}${slot !== undefined ? '__' + slot : ''}`;
  const inner = document.getElementById(innerId);
  
  if (!inner) {
    console.warn('[validation] ❌ No se encontró contenedor interno:', innerId);
    return false;
  }
  
  const currentCount = inner.querySelectorAll(".dinosaurio__recinto").length;
  const isEmpty = currentCount === 0;
  
  // Si la casilla ya tiene un dinosaurio, no es válida
  if (!isEmpty) {
    console.log('[validation] ❌ Casilla ocupada');
    return false;
  }
  
  // El río siempre es válido si está vacío (RNF48)
  if (zoneType === 'river') {
    console.log('[validation] ✅ Río - siempre válido si está vacío (RNF48)');
    return true;
  }
  
  // El recinto "island" (solo) siempre es válido si está vacío (similar al río)
  if (zoneType === 'island') {
    console.log('[validation] ✅ Isla Solitaria - siempre válido si está vacío');
    return true;
  }
  
  if (state.diceRolled && state.currentDice && state.diceRolledBySeat !== null) {
    console.log('[validation] Aplicando restricción del dado a todos los jugadores');
    console.log('[validation] activeSeat:', state.activeSeat, 'diceRolledBySeat:', state.diceRolledBySeat);
    console.log('[validation] Verificando restricción del dado:', state.currentDice);
    console.log('[validation] Zona:', {
      type: zoneType,
      area: zone.dataset.area,
      side: zone.dataset.side
    });
    
    const isValid = checkDiceRestriction(zone, dinoType, inner);
    console.log('[validation] Resultado:', isValid ? 'VÁLIDO' : 'INVÁLIDO');
    
    return isValid;
  }
  
  console.log('[validation] No hay restricción de dado (dado no lanzado)');
  return true;
}

function checkDiceRestriction(zone, dinoType, inner) {
  const diceConfig = DICE_CONFIG[state.currentDice];
  const zoneArea = zone.dataset.area;
  const zoneSide = zone.dataset.side;
  
  console.log('[checkDiceRestriction] Validando:', {
    dado: state.currentDice,
    zoneArea,
    zoneSide,
    dinoType
  });
  
  if (!diceConfig) {
    console.warn('[checkDiceRestriction] ⚠️ No se encontró configuración del dado');
    return true;
  }
  
  let result = false;
  let reason = '';
  
  switch (state.currentDice) {
    case 'bosque':
      // RF34: Debes colocar en el área de Bosque (Árboles Comunes)
      result = zoneArea === 'bosque';
      reason = result ? 'Área correcta: bosque' : `Área incorrecta: ${zoneArea} (debe ser bosque)`;
      break;
      
    case 'llanura':
      // RF35: Debes colocar en el área de Llanura (Manzanos)
      result = zoneArea === 'llanura';
      reason = result ? 'Área correcta: llanura' : `Área incorrecta: ${zoneArea} (debe ser llanura)`;
      break;
      
    case 'banos':
      // RF36: Debes colocar en el lado derecho (Baños)
      result = zoneSide === 'derecha';
      reason = result ? 'Lado correcto: derecha' : `Lado incorrecto: ${zoneSide} (debe ser derecha)`;
      break;
      
    case 'cafeteria':
      // RF37: Debes colocar en el lado izquierdo (Cafeterías)
      result = zoneSide === 'izquierda';
      reason = result ? 'Lado correcto: izquierda' : `Lado incorrecto: ${zoneSide} (debe ser izquierda)`;
      break;
      
    case 'vacio':
      // RF38: Recinto vacío - cualquier casilla vacía (ya verificamos eso arriba)
      result = true;
      reason = 'Recinto vacío válido';
      break;
      
    case 'no-trex':
      const allDinosInEnclosure = inner.querySelectorAll('.dinosaurio__recinto');
      let hasTrexInEnclosure = false;
      
      allDinosInEnclosure.forEach(dino => {
        const title = dino.getAttribute('title') || '';
        const imgSrc = dino.querySelector('img')?.getAttribute('src') || '';
        const imgAlt = dino.querySelector('img')?.getAttribute('alt') || '';
        
        if (title.toLowerCase().includes('rojo') || 
            title.toLowerCase().includes('t-rex') || 
            title.toLowerCase().includes('trex') ||
            imgSrc.toLowerCase().includes('rojo') ||
            imgAlt.toLowerCase().includes('rojo')) {
          hasTrexInEnclosure = true;
        }
      });
      
      result = !hasTrexInEnclosure;
      reason = result ? 'Recinto sin T-Rex - válido' : 'Recinto ya tiene T-Rex - inválido';
      break;
      
    default:
      result = true;
      reason = 'Dado desconocido, permitiendo colocación';
  }
  
  console.log(`[checkDiceRestriction] ${result ? '✅' : '❌'} ${reason}`);
  return result;
}

function showPlacementError(zone) {
  // Si no hay restricción de dado, es solo que está ocupada
  if (!state.currentDice) {
    showNotification('❌ Esta casilla ya está ocupada.', 'error');
    return;
  }
  
  // Construir mensaje de error específico según el dado
  const config = DICE_CONFIG[state.currentDice];
  const zoneArea = zone.dataset.area;
  const zoneSide = zone.dataset.side;
  
  let message = '🚫 <strong>NO PUEDES COLOCAR AQUÍ</strong><br><br>';
  
  switch (state.currentDice) {
    case 'bosque':
      message += `🌲 El dado indica: <strong>ÁRBOLES COMUNES</strong><br>`;
      message += `Debes colocar en el área superior (Bosque)<br>`;
      message += `Esta zona es: <strong>${zoneArea === 'bosque' ? 'Bosque ✅' : 'Llanura ❌'}</strong>`;
      break;
      
    case 'llanura':
      message += `🌱 El dado indica: <strong>MANZANOS</strong><br>`;
      message += `Debes colocar en el área inferior (Llanura)<br>`;
      message += `Esta zona es: <strong>${zoneArea === 'llanura' ? 'Llanura ✅' : 'Bosque ❌'}</strong>`;
      break;
      
    case 'banos':
      message += `🚻 El dado indica: <strong>BAÑOS</strong><br>`;
      message += `Debes colocar en el lado derecho<br>`;
      message += `Esta zona es: <strong>${zoneSide === 'derecha' ? 'Derecha ✅' : zoneSide === 'izquierda' ? 'Izquierda ❌' : 'Centro ❌'}</strong>`;
      break;
      
    case 'cafeteria':
      message += `☕ El dado indica: <strong>CAFETERÍAS</strong><br>`;
      message += `Debes colocar en el lado izquierdo<br>`;
      message += `Esta zona es: <strong>${zoneSide === 'izquierda' ? 'Izquierda ✅' : zoneSide === 'derecha' ? 'Derecha ❌' : 'Centro ❌'}</strong>`;
      break;
      
    case 'vacio':
      message += `📦 El dado indica: <strong>RECINTO VACÍO</strong><br>`;
      message += `Debes colocar en un recinto que esté completamente vacío`;
      break;
      
    case 'no-trex':
      message += `🚫 El dado indica: <strong>SIN T-REX</strong><br>`;
      message += `No puedes colocar donde ya hay un T-Rex (dinosaurio rojo)`;
      break;
      
    default:
      message += config ? config.description : 'Restricción desconocida';
  }
  
  message += '<br><br>💡 <strong>TIP:</strong> Siempre puedes colocar en el río o en la isla solitaria.';
  
  showNotification(message, 'error');
}

// ===========================
// SISTEMA DE TIMER
// ===========================

function startTimer() {
  state.timeLeft = 60;
  clearInterval(state.timer);
  updateTimerDisplay();
  
  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    
    if (state.timeLeft <= 0) {
      handleTimeout();
    }
  }, 1000);
  
  console.log('[timer] ⏱️ Timer iniciado - 60 segundos para jugador activo:', state.activeSeat);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer');
  if (!display) return;
  
  display.textContent = `${state.timeLeft}s`;
  display.className = 'timer';
  
  if (state.timeLeft <= 10) {
    display.classList.add('danger');
  } else if (state.timeLeft <= 30) {
    display.classList.add('warning');
  }
}

async function handleTimeout() {
  console.log('[timeout] ⏰ Tiempo agotado para jugador activo:', state.activeSeat);
  clearInterval(state.timer);
  state.timer = null;
  
  // RF22: Colocar automáticamente en el río si no se ha colocado nada
  if (!state.placedThisTurn) {
    try {
      // CORRECCIÓN: Usar activeSeat (jugador activo) en lugar de playerSeat
      const data = await fetchJSON(
        `${getApiBase()}/api/game/bag/${state.gameId}/${state.activeSeat}`
      );
      
      if (data && data.success && data.bag && data.bag.length > 0) {
        const firstDino = data.bag[0];
        
        const playerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
        showNotification(`⏰ TIEMPO AGOTADO PARA ${playerName}! DINOSAURIO AL RÍO AUTOMÁTICAMENTE.`, 'warning');
        
        console.log('[timeout] Colocando automáticamente en el río:', {
          gameId: state.gameId,
          activeSeat: state.activeSeat,
          dinoId: firstDino.id || firstDino.bag_content_id
        });
        
        await placeDino(
          state.gameId,
          state.activeSeat,
          parseInt(firstDino.id || firstDino.bag_content_id, 10),
          7
        );
        
        resetDice();
        await showLoading("TURNO COMPLETADO...");
        await reloadView();
        attachDropHandlers();
        
        console.log('[timeout] ✅ Dinosaurio colocado y turno avanzado');
      } else {
        console.warn('[timeout] No hay dinosaurios en la bolsa para colocar');
      }
    } catch (err) {
      console.error("[timeout] Error al manejar timeout:", err.message);
    } finally {
      hideLoading();
    }
  } else {
    console.log('[timeout] Ya se colocó un dinosaurio este turno, no se hace nada');
  }
}

// ===========================
// CARGA INICIAL Y CONFIGURACIÓN
// ===========================

async function determineSeat(gameId) {
  const userId = obtenerIdUsuario();
  try {
    const data = await fetchJSON(
      `${getApiBase()}/api/game/resume/${gameId}?user_id=${userId}`
    );
    console.log("[resume] response", data);
    
    if (data && data.success && data.game_state && typeof data.game_state.playerSeat === "number") {
      const playerSeat = data.game_state.playerSeat;
      console.log("[resume] playerSeat:", playerSeat);
      
      // Cargar nombres de jugadores disponibles
      for (let i = 0; i < 5; i++) {
        const nameKey = `player${i + 1}_username`;
        const altKey = `player${i + 1}_name`;
        const name = data.game_state[nameKey] || data.game_state[altKey];
        if (name && (!state.playerNames[i] || state.playerNames[i] === `Jugador ${i + 1}` || state.playerNames[i] === `JUGADOR ${i + 1}`)) {
          state.playerNames[i] = name.toUpperCase();
        }
      }
      
      // Obtener board_type del backend si está disponible
      if (data.game_state.board_type) {
        localStorage.setItem('boardType', data.game_state.board_type);
        console.log('[determineSeat] Board type obtenido del backend:', data.game_state.board_type);
      }
      
      // SINCRONIZAR ESTADO DEL DADO DESDE EL BACKEND AL INICIALIZAR
      if (data.game_state.last_die_roll && data.game_state.last_die_roll.die_face) {
        // Mapeo inverso: backend → frontend
        const backendToFrontendDiceMapping = {
          'FOREST': 'bosque',           // RF34: Árboles Comunes
          'ROCKS': 'llanura',           // RF35: Manzanos
          'LEFT_SIDE': 'cafeteria',     // RF37: Cafeterías
          'RIGHT_SIDE': 'banos',        // RF36: Baños
          'EMPTY': 'vacio',             // RF38: Recinto Vacío
          'NO_TREX': 'no-trex'          // RF39: Recinto sin T-REX
        };
        
        const backendDieFace = data.game_state.last_die_roll.die_face;
        const frontendDieFace = backendToFrontendDiceMapping[backendDieFace];
        const affectedSeatFromBackend = data.game_state.last_die_roll.affected_player_seat ?? data.game_state.last_die_roll.affectedSeat;
        
        if (frontendDieFace) {
          console.log('[determineSeat] Sincronizando estado del dado desde backend:', {
            backendDieFace,
            frontendDieFace,
            affectedSeatFromBackend
          });
          
          state.currentDice = frontendDieFace;
          state.diceRolled = true;
          state.diceRolledBySeat = affectedSeatFromBackend;
          state.diceRollPending = false;
          state.diceRollTimestamp = Date.now();
        }
      } else {
        // Si no hay dado en el backend y hay estado de dado en el frontend, limpiar
        if (state.currentDice || state.diceRolled) {
          console.log('[determineSeat] No hay dado en backend, limpiando estado del dado en frontend');
          state.currentDice = null;
          state.diceRolled = false;
          state.diceRolledBySeat = null;
          state.diceRollPending = false;
          state.diceRollTimestamp = null;
        }
      }
      
      return playerSeat;
    }
    console.warn("[resume] No playerSeat in response; using default 0");
  } catch (e) {
    console.warn("[resume] Error:", e.message);
  }
  return 0;
}

/**
 * ✅ FUNCIÓN ACTUALIZADA: Lee configuración desde localStorage
 * NO requiere backend de salas
 */
async function loadRoomData() {
  try {
    // 1. Leer datos de localStorage (guardados por waiting-room)
    const direction = localStorage.getItem('gameDirection') || 'clockwise';
    
    // 2. Leer totalPlayers - este es el que realmente importa
    const totalPlayersStr = localStorage.getItem('totalPlayers');
    const playerNamesStr = localStorage.getItem('playerNames');
    
    console.log('[room] Datos RAW desde localStorage:', {
      totalPlayers: totalPlayersStr,
      playerNames: playerNamesStr
    });
    
    let totalPlayers = parseInt(totalPlayersStr) || 2;
    console.log('[room] totalPlayers parseado:', totalPlayers);
    
    // 3. Parsear nombres de jugadores
    let playerNames = {};
    try {
      const parsedNames = JSON.parse(playerNamesStr || '{}');
      // Convertir todos los nombres a mayúsculas
      for (const key in parsedNames) {
        if (parsedNames[key] && typeof parsedNames[key] === 'string') {
          playerNames[key] = parsedNames[key].toUpperCase();
        }
      }
    } catch (e) {
      console.warn('[room] Error parseando playerNames, usando defaults:', e);
      playerNames = {};
    }
    
    console.log('[room] playerNames parseado (en mayúsculas):', playerNames);

    // 4. Asignar al estado global - TODOS los jugadores sin limitar
    state.totalPlayers = totalPlayers;
    state.gameDirection = direction;
    state.playerNames = playerNames;
    
    console.log('[room] ✅ Configuración cargada desde localStorage:', {
      totalPlayers: state.totalPlayers,
      direction: state.gameDirection,
      players: state.playerNames
    });
    
    // 4. Si no hay nombres, generar automáticamente
    if (Object.keys(state.playerNames).length === 0) {
      console.log('[room] Generando nombres por defecto...');
      for (let i = 0; i < state.totalPlayers; i++) {
        state.playerNames[i] = `JUGADOR ${i + 1}`;
      }
    }
    
    // 5. Validar que tengamos nombres para todos los jugadores
    for (let i = 0; i < state.totalPlayers; i++) {
      if (!state.playerNames[i]) {
        state.playerNames[i] = `JUGADOR ${i + 1}`;
      }
    }
    
    console.log('[room] 📋 Estado final:', {
      totalPlayers: state.totalPlayers,
      direction: state.gameDirection,
      playerNames: state.playerNames
    });
    
  } catch (e) {
    console.error('[room] ❌ Error cargando datos de sala:', e.message);
    
    // Valores por defecto si todo falla
    state.totalPlayers = 2;
    state.gameDirection = 'clockwise';
    state.playerNames = {
      0: 'JUGADOR 1',
      1: 'JUGADOR 2'
    };
    
    console.log('[room] ⚠️ Usando configuración por defecto');
  }
}

async function ensurePlayerNames() {
  try {
    const data = await fetchJSON(`${getApiBase()}/api/game/state/${state.gameId}`);
    const gs = data?.game_state;
    if (!gs) return;
    
    for (let i = 0; i < state.totalPlayers; i++) {
      // Actualizar nombre si no existe o es un placeholder genérico
      const currentName = state.playerNames[i];
      const isPlaceholder = !currentName || currentName === `Jugador ${i + 1}` || currentName === `JUGADOR ${i + 1}`;
      
      if (isPlaceholder) {
        const nameKey = `player${i + 1}_username`;
        const altKey = `player${i + 1}_name`;
        const name = gs[nameKey] || gs[altKey];
        if (name) state.playerNames[i] = name.toUpperCase();
      }
    }
  } catch (e) {
    console.warn('[names] Error:', e.message);
  }
}

async function loadEnclosuresMeta(gameId, playerSeat) {
  try {
    const meta = await fetchJSON(
      `${getApiBase()}/api/game/enclosures/${gameId}/${playerSeat}`
    );
    const map = {};
    if (meta?.success && Array.isArray(meta.enclosures)) {
      meta.enclosures.forEach((e) => {
        const id = parseInt(e.enclosures_id, 10);
        if (!isNaN(id)) map[id] = parseInt(e.max_dinos ?? 6, 10);
      });
      console.log("[enclosures meta] loaded:", map);
    }
    state.enclosuresMax = map;
  } catch (e) {
    console.warn("[enclosures meta] Error:", e.message);
    state.enclosuresMax = { 1: 6, 2: 6, 3: 6, 4: 3, 5: 1, 6: 1, 7: 6 };
  }
}

// ===========================
// SISTEMA DE POLLING (MULTI-JUGADOR)
// ===========================

async function startPolling() {
  if (state.isPolling) {
    console.log('[polling] Ya hay polling activo');
    return;
  }
  
  state.isPolling = true;
  console.log('[polling] Iniciando polling cada', POLLING_INTERVAL, 'ms');
  
  state.pollingInterval = setInterval(async () => {
    try {
      await checkGameState();
    } catch (e) {
      console.error('[polling] Error:', e.message);
    }
  }, POLLING_INTERVAL);
}

function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
    state.isPolling = false;
    console.log('[polling] Polling detenido');
  }
}

async function checkGameState() {
  try {
    if (state.isReloading) {
      console.log('[polling] Reload en proceso, omitiendo verificación de estado');
      return;
    }
    
    const data = await fetchJSON(`${getApiBase()}/api/game/state/${state.gameId}`);
    const gs = data?.game_state;
    if (!gs) return;
    
    const newActiveSeat = gs.active_seat ?? gs.activeSeat ?? 0;
    const newTurn = gs.current_turn ?? gs.currentTurn ?? 1;
    
    // SINCRONIZAR ESTADO DEL DADO DESDE EL BACKEND
    // El backend devuelve last_die_roll con die_face y affected_player_seat
    if (gs.last_die_roll && gs.last_die_roll.die_face) {
      // Mapeo inverso: backend → frontend
      const backendToFrontendDiceMapping = {
        'FOREST': 'bosque',           // RF34: Árboles Comunes
        'ROCKS': 'llanura',           // RF35: Manzanos
        'LEFT_SIDE': 'cafeteria',     // RF37: Cafeterías
        'RIGHT_SIDE': 'banos',        // RF36: Baños
        'EMPTY': 'vacio',             // RF38: Recinto Vacío
        'NO_TREX': 'no-trex'          // RF39: Recinto sin T-REX
      };
      
      const backendDieFace = gs.last_die_roll.die_face;
      const frontendDieFace = backendToFrontendDiceMapping[backendDieFace];
      const affectedSeatFromBackend = gs.last_die_roll.affected_player_seat ?? gs.last_die_roll.affectedSeat;
      
      if (frontendDieFace) {
        if (state.diceRollPending && state.currentDice === frontendDieFace) {
          console.log('[polling] Dado confirmado por backend:', frontendDieFace);
          state.diceRollPending = false;
          if (!state.diceRolled) {
            state.diceRolled = true;
          }
          if (state.diceRolledBySeat !== affectedSeatFromBackend) {
            state.diceRolledBySeat = affectedSeatFromBackend;
          }
          console.log('[polling] Estado del dado sincronizado correctamente con el backend');
        } else if (state.currentDice !== frontendDieFace || state.diceRolledBySeat !== affectedSeatFromBackend) {
          console.log('[polling] Sincronizando estado del dado desde backend:', {
            backendDieFace,
            frontendDieFace,
            affectedSeatFromBackend,
            currentDice: state.currentDice,
            diceRolledBySeat: state.diceRolledBySeat,
            activeSeat: state.activeSeat
          });
          
          state.currentDice = frontendDieFace;
          state.diceRolled = true;
          state.diceRolledBySeat = affectedSeatFromBackend;
          state.diceRollPending = false;
          
          if (affectedSeatFromBackend !== state.activeSeat) {
            console.log('[polling] Dado sincronizado es del turno anterior (jugador', affectedSeatFromBackend, '), pero el jugador activo es', state.activeSeat);
          }
          
          updateDiceDisplay();
          highlightValidZones();
        }
      }
    } else if (!gs.last_die_roll && state.currentDice) {
      const timeSinceRoll = state.diceRollTimestamp ? (Date.now() - state.diceRollTimestamp) : Infinity;
      const isActivePlayerTurn = state.activeSeat === state.diceRolledBySeat;
      
      const shouldKeepDice = state.diceRollPending || 
                             (timeSinceRoll < 5000) ||
                             (isActivePlayerTurn && timeSinceRoll < 10000);
      
      if (shouldKeepDice) {
        console.log('[polling] Backend no tiene dado aún, pero manteniendo dado en frontend');
      } else {
        console.log('[polling] Backend reseteó el dado (todos han colocado). Reseteando en frontend...');
        resetDice();
        updateDiceDisplay();
        highlightValidZones();
      }
    }
    
    if (newActiveSeat !== state.lastKnownActiveSeat || newTurn !== state.lastKnownTurn) {
      console.log('[polling] Cambio detectado:', {
        oldSeat: state.lastKnownActiveSeat,
        newSeat: newActiveSeat,
        oldTurn: state.lastKnownTurn,
        newTurn: newTurn
      });
      
      if (newActiveSeat !== state.lastKnownActiveSeat) {
        const oldActiveSeat = state.activeSeat;
        state.activeSeat = newActiveSeat;
        state.lastKnownActiveSeat = newActiveSeat;
        
        const oldViewingBoardOf = state.viewingBoardOf;
        if (oldViewingBoardOf === oldActiveSeat || oldViewingBoardOf !== newActiveSeat) {
          state.viewingBoardOf = newActiveSeat;
          console.log('[polling] Sincronizando viewingBoardOf:', oldViewingBoardOf, '→', newActiveSeat);
        }
        
        const backendHasDice = gs.last_die_roll && gs.last_die_roll.die_face;
        if (!backendHasDice && state.currentDice) {
          console.log('[polling] Backend reseteó el dado (todos han colocado). Reseteando estado local al cambiar de turno...');
          resetDice();
        }
        
        if (state.diceRolledBySeat !== null && state.diceRolledBySeat !== newActiveSeat) {
          console.log('[polling] Nuevo jugador activo puede tirar el dado (el anterior fue:', state.diceRolledBySeat, ')');
          if (state.diceRollPending) {
            console.log('[polling] Reseteando diceRollPending al cambiar de turno');
            state.diceRollPending = false;
          }
        } else if (state.diceRolledBySeat === newActiveSeat && !backendHasDice) {
          console.log('[polling] Jugador activo es el mismo que tiró el dado, pero backend lo reseteó - permitiendo nuevo lanzamiento');
          state.diceRollPending = false;
        }
        
        clearInterval(state.timer);
        state.timer = null;
        
        const playerName = state.playerNames[newActiveSeat] || `JUGADOR ${newActiveSeat + 1}`;
        const isMyTurn = state.playerSeat === newActiveSeat;
        
        if (isMyTurn) {
          showNotification(`🎮 ES TU TURNO, ${playerName.toUpperCase()}! LANZA EL DADO!`, 'success');
          playNotificationSound();
        } else {
          showNotification(`⏳ TURNO DE ${playerName.toUpperCase()}. Espera tu turno...`, 'info');
        }
        
        console.log('[polling] Iniciando timer para nuevo jugador activo:', newActiveSeat);
        startTimer();
        setupDiceButton();
        await reloadView();
        attachDropHandlers();
      }
      
      state.lastKnownTurn = newTurn;
    }
    
    if (!state.isReloading) {
      updateDiceButtonVisibility();
    }
    
    // Actualizar board_type si está disponible en el estado del juego
    if (gs && gs.board_type && gs.board_type !== localStorage.getItem('boardType')) {
      localStorage.setItem('boardType', gs.board_type);
      applyBoardTheme(gs.board_type);
      console.log('[polling] Board type actualizado desde backend:', gs.board_type);
    }
  } catch (e) {
    console.error('[polling] Error al verificar estado:', e.message);
  }
}

// ===========================
// RENDERIZADO
// ===========================

async function renderBag(gameId, playerSeat) {
  const cont = document.getElementById("player-bag");
  if (!cont) {
    console.error("[bag] ❌ No se encontró el contenedor de la bolsa");
    return;
  }
  
  cont.innerHTML = "";
  
  try {
    const data = await fetchJSON(
      `${getApiBase()}/api/game/bag/${gameId}/${playerSeat}`
    );
    if (!data?.success) {
      console.warn("[bag] No se pudo cargar la bolsa:", data);
      return;
    }
    const bag = Array.isArray(data.bag) ? data.bag : [];
    console.log(`[bag] Renderizando ${bag.length} dinosaurios para playerSeat ${playerSeat}`);
    
    const seenDinoIds = new Set();
    
    bag.forEach((dino) => {
      const dinoId = dino.id || dino.bag_content_id;
      
      if (seenDinoIds.has(dinoId)) {
        console.warn(`[bag] Dinosaurio ${dinoId} ya renderizado, omitiendo`);
        return;
      }
      seenDinoIds.add(dinoId);
      
      const wrapper = document.createElement("div");
      wrapper.className = "dino";

      const img = document.createElement("img");
      img.draggable = true;
      img.src = imageForHorizontal(dino.dinosaur_type || "amarillo");
      img.alt = dino.dinosaur_type || "dino";
      img.dataset.dinoId = dinoId;
      img.dataset.color = dino.dinosaur_type || "amarillo";
      
      img.addEventListener("dragstart", (e) => {
        if (!state.diceRolled) {
          e.preventDefault();
          showNotification('⚠️ Debes lanzar el dado antes de colocar un dinosaurio', 'warning');
          console.log('[dragstart] Bloqueado: dado no lanzado');
          return;
        }
        
        try {
          e.dataTransfer.effectAllowed = "move";
        } catch {}
        const dinoId = String(img.dataset.dinoId);
        const color = String(img.dataset.color);
        
        e.dataTransfer.setData("dinoId", dinoId);
        e.dataTransfer.setData("color", color);
        
        console.log('[dragstart] Arrastrando dinosaurio:', {
          dinoId,
          color,
          activeSeat: state.activeSeat,
          currentDice: state.currentDice,
          diceRolled: state.diceRolled
        });
        
        wrapper.classList.add("dragging");
        highlightValidZones(color);
      });

      img.addEventListener("dragend", () => {
        wrapper.classList.remove("dragging");
        clearHighlights();
      });

      wrapper.appendChild(img);
      cont.appendChild(wrapper);
    });
  } catch (e) {
    console.error("[bag] Error:", e.message);
  }
}

async function renderEnclosure(gameId, playerSeat, enclosureId) {
  const containerId = Object.keys(ENCLOSURE_CONTAINER_TO_ID).find(
    (k) => ENCLOSURE_CONTAINER_TO_ID[k] === enclosureId
  );
  if (!containerId) {
    console.warn(`[enclosure] No container ID found for enclosure ${enclosureId}`);
    return;
  }
  
  const baseId = containerId.replace('dinos__', '');
  
  const allContainers = document.querySelectorAll(`[id^="dinos__${baseId}"]`);
  
  allContainers.forEach(cont => {
    const contId = cont.id;
    if (contId.startsWith(`dinos__${baseId}`)) {
      cont.innerHTML = "";
      console.log(`[enclosure ${enclosureId}] Limpiado contenedor: ${contId}`);
    }
  });
  
  try {
    const data = await fetchJSON(
      `${getApiBase()}/api/game/enclosure/${gameId}/${playerSeat}/${enclosureId}`
    );
    
    if (!data?.success) {
      console.warn(`[enclosure ${enclosureId}] No se pudo cargar:`, data);
      return;
    }
    
    const dinos = Array.isArray(data.dinos) ? data.dinos : [];
    console.log(`========================================`);
    console.log(`[enclosure ${enclosureId}] Renderizando ${dinos.length} dinosaurios para playerSeat ${playerSeat}`);
    console.log(`[enclosure ${enclosureId}] Datos del backend:`, data.dinos);
    console.log(`========================================`);
    
    const seenDinoIds = new Set();
    
    dinos.forEach((d, index) => {
      const dinoId = d.dino_id || d.id || d.placement_id;
      
      if (seenDinoIds.has(dinoId)) {
        console.warn(`[enclosure ${enclosureId}] Dinosaurio ${dinoId} ya renderizado, omitiendo`);
        return;
      }
      seenDinoIds.add(dinoId);
      
      console.log(`[enclosure ${enclosureId}] Procesando dinosaurio ${index + 1}/${dinos.length}:`, d);
      
      // Usar el slot_index del backend si existe, sino usar un contador
      const slotIndex = d.slot_index !== undefined && d.slot_index !== null ? d.slot_index : 0;
      const targetId = `dinos__${baseId}__${slotIndex}`;
      let targetCont = document.getElementById(targetId);
      
      console.log(`[enclosure ${enclosureId}] Buscando contenedor:`, {
        targetId,
        encontrado: !!targetCont,
        slotIndex,
        baseId,
        containerId
      });
      
      // Si no existe slot específico, usar el contenedor base
      if (!targetCont) {
        targetCont = document.getElementById(containerId);
        console.log(`[enclosure ${enclosureId}] No existe slot ${slotIndex}, usando contenedor base:`, containerId, !!targetCont);
      }
      
      if (!targetCont) {
        console.error(`[enclosure ${enclosureId}] ❌ ERROR: No se encontró NINGÚN contenedor para el dinosaurio!`, {
          targetId,
          containerId,
          slotIndex
        });
        return;
      }
      
      const existingDinos = targetCont.querySelectorAll('.dinosaurio__recinto');
      const alreadyExists = Array.from(existingDinos).some(el => {
        const existingDinoId = el.dataset.dinoId || el.getAttribute('data-dino-id');
        return existingDinoId == dinoId;
      });
      
      if (alreadyExists) {
        console.warn(`[enclosure ${enclosureId}] Dinosaurio ${dinoId} ya existe en contenedor ${targetCont.id}, omitiendo`);
        return;
      }
      
      // Crear y agregar el elemento del dinosaurio
      const div = document.createElement("div");
      div.className = "dinosaurio__recinto";
      const imgPath = imageForVertical(d.dinosaur_type || "amarillo");
      div.style.backgroundImage = `url('${imgPath}')`;
      div.title = `${d.dinosaur_type || ""} #${dinoId}`;
      div.dataset.dinoId = dinoId;
      div.dataset.slotIndex = slotIndex;
      
      targetCont.appendChild(div);
      
      console.log(`[enclosure ${enclosureId}] ✅ Dinosaurio renderizado:`, {
        dinoId: dinoId,
        slot: slotIndex,
        tipo: d.dinosaur_type,
        imagen: imgPath,
        contenedor: targetCont.id,
        elementosEnContenedor: targetCont.children.length
      });
    });
  } catch (e) {
    console.error(`[enclosure ${enclosureId}] Error:`, e.message);
  }
}

async function renderAllEnclosures(gameId, playerSeat) {
  const promises = Object.values(ENCLOSURE_CONTAINER_TO_ID).map((id) =>
    renderEnclosure(gameId, playerSeat, id)
  );
  await Promise.all(promises);
}


function highlightValidZones(dinoType = null) {
  // Limpiar highlights anteriores
  clearHighlights();
  
  const dropZones = Array.from(document.querySelectorAll(".drop-zone"));
  
  dropZones.forEach((zone) => {
    const zoneType = zone.dataset.zone;
    if (!zoneType) return;

    const slot = zone.dataset.slot;
    const innerId = `dinos__${getInternalName(zoneType)}${slot !== undefined ? '__' + slot : ''}`;
    const inner = document.getElementById(innerId);
    
    if (!inner) return;
    
    const currentCount = inner.querySelectorAll(".dinosaurio__recinto").length;
    
    // Solo resaltar si está vacío y es válido para el tipo de dinosaurio
    if (currentCount === 0 && isValidPlacement(zone, dinoType)) {
      zone.classList.add("rec--parpadeo");
    }
  });
  
  console.log('[highlight] Zonas válidas resaltadas para tipo:', dinoType || 'cualquiera');
}

function clearHighlights() {
  const dropZones = Array.from(document.querySelectorAll(".drop-zone"));
  dropZones.forEach((zone) => {
    zone.classList.remove("rec--parpadeo");
  });
}

// ===========================
// DRAG & DROP
// ===========================

// Remover todos los drop handlers anteriores
function removeDropHandlers() {
  if (state.dropHandlers.length === 0) return;
  
  console.log('[dropHandlers] Removiendo', state.dropHandlers.length, 'handlers anteriores');
  
  state.dropHandlers.forEach(({ zone, handlers }) => {
    handlers.forEach(({ event, handler }) => {
      zone.removeEventListener(event, handler);
    });
  });
  
  state.dropHandlers = [];
}

function attachDropHandlers() {
  removeDropHandlers();
  
  const dropZones = Array.from(document.querySelectorAll(".drop-zone"));
  
  dropZones.forEach((zone) => {
    const zoneType = zone.dataset.zone;
    if (!zoneType) return;

    // Crear handlers
    const dragoverHandler = (e) => {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = "move";
      } catch {}
    };
    
    const dragenterHandler = (e) => {
      e.preventDefault();
      
      const slot = zone.dataset.slot;
      const innerId = `dinos__${getInternalName(zoneType)}${slot !== undefined ? '__' + slot : ''}`;
      const inner = document.getElementById(innerId);
      
      if (!inner) return;
      
      const currentCount = inner.querySelectorAll(".dinosaurio__recinto").length;

      if (currentCount === 0 && isValidPlacement(zone, null)) {
        zone.classList.add("rec--parpadeo");
      }
    };
    
    const dragleaveHandler = (e) => {
      if (e.target === zone || e.currentTarget === zone) {
        zone.classList.remove("rec--parpadeo");
      }
    };
    
    const dropHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("rec--parpadeo");
      
      if (state.isPlacing) {
        console.log("[drop] Ya se está colocando un dino, ignorando");
        return;
      }
      
      if (state.playerSeat !== state.activeSeat) {
        const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
        showNotification(`⏳ No es tu turno. Espera a que ${activePlayerName} coloque su dinosaurio.`, 'warning');
        console.log("[drop] Bloqueado: no es el turno del jugador. Turno de:", activePlayerName);
        return;
      }
      
      if (state.viewingBoardOf !== state.activeSeat) {
        showNotification('⚠️ No puedes colocar en este tablero. Estás viendo el tablero de otro jugador.', 'error');
        console.log("[drop] Bloqueado: intentando colocar en tablero de otro jugador");
        return;
      }

      const dinoId = e.dataTransfer.getData("dinoId");
      const color = e.dataTransfer.getData("color");
      
      console.log("[DROP] dinoId:", dinoId, "color:", color, "zone:", zoneType);
      
      if (!dinoId) {
        console.warn("[drop] No dinoId");
        return;
      }

      const zoneToEnclosure = {
        'forest-same': 1,
        'prairie-diff': 2,
        'love-prairie': 3,
        'trio': 4,
        'king': 5,
        'island': 6,
        'river': 7
      };

      const enclosureId = zoneToEnclosure[zoneType];
      if (!enclosureId) {
        console.warn("[drop] No enclosureId for", zoneType);
        return;
      }
      
      console.log('[drop] Zona detectada:', {
        zoneType,
        enclosureId,
        isKing: enclosureId === 5,
        isIsland: enclosureId === 6
      });

      const slot = zone.dataset.slot;
      const innerId = `dinos__${getInternalName(zoneType)}${slot !== undefined ? '__' + slot : ''}`;
      const inner = document.getElementById(innerId);
      
      if (!inner) {
        console.warn("[drop] No contenedor interno:", innerId);
        return;
      }
      
      const currentCount = inner.querySelectorAll(".dinosaurio__recinto").length;
      
      if (currentCount > 0) {
        showNotification("Esta casilla ya está ocupada.", "error");
        return;
      }

      const isRiverOrIsland = zoneType === 'river' || zoneType === 'island';
      
      if (!state.diceRolled && !isRiverOrIsland) {
        showNotification('⚠️ Debes lanzar el dado antes de colocar un dinosaurio', 'warning');
        console.log("[drop] Bloqueado: dado no lanzado");
        return;
      }

      console.log('[drop] ========================================');
      console.log('[drop] VALIDANDO COLOCACIÓN');
      console.log('[drop] Estado del dado:', {
        currentDice: state.currentDice,
        diceRolled: state.diceRolled,
        diceRolledBySeat: state.diceRolledBySeat,
        playerSeat: state.playerSeat,
        activeSeat: state.activeSeat,
        diceRollPending: state.diceRollPending
      });
      console.log('[drop] Zona:', {
        zoneType,
        area: zone.dataset.area,
        side: zone.dataset.side,
        enclosureId
      });
      console.log('[drop] ========================================');
      
      const isValid = isValidPlacement(zone, color);
      console.log('[drop] isValidPlacement devolvió:', isValid);
      
      if (!isValid) {
        console.log('[drop] ❌ Colocación RECHAZADA por validación');
        showPlacementError(zone);
        return;
      }
      
      console.log('[drop] ✅ Colocación ACEPTADA, procediendo...');

      try {
        state.isPlacing = true;
        state.placedThisTurn = true;
        
        const slotIndex = slot !== undefined ? parseInt(slot, 10) : null;
        
        console.log('========================================');
        console.log(`[DROP EVENT] 🎯 Colocando dinosaurio`);
        console.log(`  activeSeat: ${state.activeSeat}`);
        console.log(`  gameId: ${state.gameId}`);
        console.log(`  dinoId: ${dinoId}`);
        console.log(`  enclosureId: ${enclosureId}`);
        console.log(`  slotIndex: ${slotIndex}`);
        console.log(`  zone: ${zoneType}`);
        console.log(`  targetContainer: ${innerId}`);
        console.log('========================================');
        
        if (state.viewingBoardOf !== state.activeSeat) {
          const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
          showNotification(`⏳ No puedes colocar en este tablero. Estás viendo el tablero de otro jugador.`, 'warning');
          state.isPlacing = false;
          return;
        }
        
        const result = await placeDino(
          state.gameId,
          state.activeSeat,
          parseInt(dinoId, 10),
          enclosureId,
          slotIndex
        );
        
        console.log('[DROP EVENT] Respuesta del backend:', result);
        
        clearInterval(state.timer);
        state.timer = null;
        
        showNotification('¡Dinosaurio colocado!', 'success');
        
        console.log('[DROP EVENT] Recargando vista...');
        await showLoading("TURNO COMPLETADO...");
        await reloadView();
        console.log('[DROP EVENT] Vista recargada');
        attachDropHandlers();
      } catch (err) {
        console.error("Error al colocar dino:", err.message);
        showNotification("No se pudo colocar el dinosaurio.", "error");
      } finally {
        state.isPlacing = false;
        hideLoading();
      }
    };
    
    // Añadir event listeners
    zone.addEventListener("dragover", dragoverHandler);
    zone.addEventListener("dragenter", dragenterHandler);
    zone.addEventListener("dragleave", dragleaveHandler);
    zone.addEventListener("drop", dropHandler);
    
    // Guardar referencias para poder removerlos después
    state.dropHandlers.push({
      zone: zone,
      handlers: [
        { event: 'dragover', handler: dragoverHandler },
        { event: 'dragenter', handler: dragenterHandler },
        { event: 'dragleave', handler: dragleaveHandler },
        { event: 'drop', handler: dropHandler }
      ]
    });
  });
  
  console.log("[attachDropHandlers] ✅ Adjuntados a", dropZones.length, "zonas (handlers anteriores removidos)");
}

async function placeDino(gameId, playerSeat, dinoId, enclosureId, slotIndex = null) {
  const body = {
    game_id: gameId,
    player_seat: playerSeat,
    dino_id: dinoId,
    enclosure_id: enclosureId,
  };
  
  // Si hay slotIndex (para recintos con múltiples slots), agregarlo
  if (slotIndex !== null && slotIndex !== undefined) {
    body.slot_index = slotIndex;
  }
  
  console.log('========================================');
  console.log('[PLACE DINO] Enviando al backend:');
  console.log(JSON.stringify(body, null, 2));
  console.log('========================================');
  
  const resp = await fetchJSON(`${getApiBase()}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!resp.success) {
    throw new Error(resp.message || resp.error || "Error en turno");
  }
  return resp;
}

// ===========================
// HEADER Y ESTADO
// ===========================

async function loadAndRenderHeader() {
  try {
    await ensurePlayerNames();
    const data = await fetchJSON(`${getApiBase()}/api/game/state/${state.gameId}`);
    const gs = data?.game_state;
    if (!gs) {
      console.warn("[header] No game_state");
      return;
    }
    
    const activeSeat = gs.active_seat ?? gs.activeSeat ?? 0;
    const oldActiveSeat = state.activeSeat;
    state.activeSeat = activeSeat;
    
    if (oldActiveSeat !== activeSeat) {
      console.log('[header] Jugador activo cambió:', oldActiveSeat, '→', activeSeat);
      const oldViewingBoardOf = state.viewingBoardOf;
      if (oldViewingBoardOf === oldActiveSeat || oldViewingBoardOf !== activeSeat) {
        state.viewingBoardOf = activeSeat;
        console.log('[header] Sincronizando viewingBoardOf:', oldViewingBoardOf, '→', activeSeat);
      }
    }

    const playerLabel = document.getElementById("player");
    if (playerLabel) {
      const name = state.playerNames[activeSeat] || `JUGADOR ${activeSeat + 1}`;
      playerLabel.textContent = name;
    }
    
    const rondaEl = document.getElementById("ronda");
    if (rondaEl) {
      const round = gs.current_round ?? gs.currentRound ?? 1;
      rondaEl.textContent = `RONDA ${round}/${MAX_ROUNDS}`;
    }
    
    const turnEl = document.getElementById("colocados");
    if (turnEl) {
      const turn = gs.current_turn ?? gs.currentTurn ?? 1;
      const turnsPerRound = getTurnsPerRound();
      turnEl.textContent = `TURNO ${turn}/${turnsPerRound}`;
    }
    
    // Actualizar visibilidad del botón del dado
    updateDiceButtonVisibility();
    
    // Mostrar el contenedor del dado si hay un dado lanzado
    if (state.currentDice) {
      updateDiceDisplay();
    }
    
    if (!state.timer) {
      console.log('[header] Iniciando timer para jugador activo:', activeSeat);
      startTimer();
    }
    
    // Renderizar panel de jugadores (se ordenará después cuando se carguen los puntajes)
    // Si ya hay puntajes cargados, renderizar con ordenamiento
    if (state.playerScores && Object.keys(state.playerScores).length > 0) {
      renderPlayersPanel();
    }
  } catch (e) {
    console.warn("[header] Error:", e.message);
  }
}

/**
 * Renderiza el selector de tableros para modo local
 * Permite cambiar qué tablero estás viendo
 */
function renderBoardSelector() {
  const container = document.getElementById('board-selector-buttons');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < state.totalPlayers; i++) {
    const btn = document.createElement('button');
    btn.className = 'board-selector-btn';
    btn.textContent = state.playerNames[i] || `JUGADOR ${i + 1}`;
    btn.dataset.playerIdx = i;
    
    // Marcar el tablero que estamos viendo actualmente
    if (i === state.viewingBoardOf) {
      btn.classList.add('active');
    }
    
    // Marcar el jugador con turno actual
    if (i === state.activeSeat) {
      btn.classList.add('current-turn');
      btn.textContent += ' 🎮';
    }
    
    // Al hacer clic, cambiar el tablero que estamos viendo
    btn.addEventListener('click', async () => {
      if (state.viewingBoardOf === i) return; // Ya estamos viendo este tablero
      
      if (state.isReloading) {
        console.log('[boardSelector] Reload en proceso, esperando...');
        return;
      }
      
      console.log('[boardSelector] Cambiando vista del tablero:', state.viewingBoardOf, '→', i);
      state.viewingBoardOf = i;
      
      const bagContainer = document.getElementById("player-bag");
      if (bagContainer) {
        bagContainer.innerHTML = "";
      }
      
      const allEnclosureContainers = document.querySelectorAll('[id^="dinos__"]');
      allEnclosureContainers.forEach(cont => {
        cont.innerHTML = "";
      });
      
      await Promise.all([
        renderBag(state.gameId, state.activeSeat),
        renderAllEnclosures(state.gameId, i)
      ]);
      renderBoardSelector();
      
      updateTimerDisplay();
      
      showNotification(`📋 VIENDO TABLERO DE ${state.playerNames[i] || 'JUGADOR ' + (i + 1)}`, 'info');
    });
    
    container.appendChild(btn);
  }
  
  console.log('[boardSelector] Selector renderizado para', state.totalPlayers, 'jugadores');
}

/**
 * ✅ FUNCIÓN ACTUALIZADA: Actualiza panel DINÁMICO de jugadores (2-5 jugadores)
 */
function renderPlayersPanel() {
  console.log('[players] renderPlayersPanel llamado - totalPlayers:', state.totalPlayers, 'playerNames:', state.playerNames);
  
  const containerInfo = document.querySelector('.info'); // Contenedor de jugadores
  if (!containerInfo) {
    console.warn('[players] No se encontró .info container');
    return;
  }
  
  // Limpiar solo los jugadores (el botón ya está fuera de .info)
  containerInfo.innerHTML = '';
  
  // Crear array de jugadores con sus puntajes para ordenar
  const players = [];
  for (let i = 0; i < state.totalPlayers; i++) {
    // Usar puntajes del estado si están disponibles, sino intentar leer del DOM
    let currentScore = 0;
    if (state.playerScores && state.playerScores[i] !== undefined) {
      currentScore = state.playerScores[i];
    } else {
      const scoreEl = document.getElementById(`player-${i}-score`);
      currentScore = scoreEl ? parseInt(scoreEl.textContent.match(/\d+/)?.[0] || '0') : 0;
    }
    
    players.push({
      seat: i,
      name: state.playerNames[i] || `JUGADOR ${i + 1}`,
      score: currentScore,
      isActive: i === state.activeSeat
    });
  }
  
  // Ordenar jugadores: primero por puntaje (mayor a menor), luego por seat
  players.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Mayor puntaje primero
    }
    return a.seat - b.seat; // Si empate, orden por seat
  });
  
  // Renderizar jugadores ordenados
  for (const player of players) {
    const playerEl = document.createElement('div');
    playerEl.className = player.seat === 0 ? 'user king' : 'user user__uno';
    playerEl.dataset.playerSeat = player.seat;
    
    playerEl.innerHTML = `
      <div class="icon__user"></div>
      <div class="info__users">
        <div class="info__users__top">
          <p class="nombre__user" id="player-${player.seat}-name">${player.name}</p>
          <div class="corona" title="JUGADOR CON MAYOR PUNTUACIÓN" style="display: none;"></div>
        </div>
        <p class="punto" id="player-${player.seat}-score">PUNTAJE: ${player.score}P</p>
      </div>
    `;
    
    containerInfo.appendChild(playerEl);
  }
  
  console.log('[players] Panel actualizado con', state.totalPlayers, 'jugadores ordenados');
}

async function reloadView() {
  if (state.isReloading) {
    console.log('[reloadView] Ya hay un reload en proceso, omitiendo...');
    return;
  }
  
  state.isReloading = true;
  
  try {
    console.log('[reloadView] 🔄 Iniciando recarga de vista...');
    console.log('[reloadView] Cargando para:', {
      gameId: state.gameId,
      playerSeat: state.playerSeat,
      activeSeat: state.activeSeat,
      viewingBoardOf: state.viewingBoardOf
    });
    
    await loadEnclosuresMeta(state.gameId, state.viewingBoardOf);
    
    // SOLUCIÓN PARA MODO LOCAL:
    // - Bolsa: del jugador ACTIVO (quien está jugando ahora)
    // - Tablero: del jugador que estamos VIENDO (viewingBoardOf)
    
    const bagContainer = document.getElementById("player-bag");
    if (bagContainer) {
      bagContainer.innerHTML = "";
    }
    
    await Promise.all([
      renderBag(state.gameId, state.activeSeat),
      renderAllEnclosures(state.gameId, state.viewingBoardOf),
    ]);
    
    console.log('[reloadView] Bolsa del jugador activo:', state.activeSeat, '| Tablero viendo:', state.viewingBoardOf);
    console.log('[reloadView] Es mi turno?', state.playerSeat === state.activeSeat, '| playerSeat:', state.playerSeat, '| activeSeat:', state.activeSeat);
    
    await loadAndRenderHeader();
    updateDiceButtonVisibility();
    await loadAndRenderScores();
    await checkAndShowGameOver();
    renderBoardSelector();
    
    updateDiceButtonVisibility();
    setupDiceButton();
    
    console.log('[reloadView] ✅ Recarga completada');
  } catch (error) {
    console.error('[reloadView] ❌ Error durante recarga:', error);
  } finally {
    state.isReloading = false;
  }
}

async function loadAndRenderScores() {
  try {
    console.log('[scores] Cargando puntajes para gameId:', state.gameId);
    const data = await fetchJSON(`${getApiBase()}/api/game/scores/${state.gameId}`);
    console.log('[scores] Respuesta completa:', data);
    
    if (!data?.success) {
      console.warn("[scores] No se pudo cargar puntajes:", data);
      // Aún así, renderizar el panel con puntajes en 0
      renderPlayersPanel();
      return;
    }
    
    console.log('[scores] data.scores:', data.scores);
    updatePlayerPanels(data.scores);
  } catch (e) {
    console.warn("[scores] Error:", e.message);
    // En caso de error, renderizar el panel con puntajes en 0
    renderPlayersPanel();
  }
}

/**
 * ✅ FUNCIÓN ACTUALIZADA: Actualiza puntajes en panel dinámico (soporta 2-5 jugadores)
 */
function updatePlayerPanels(scores) {
  console.log('[scores] updatePlayerPanels recibió:', scores);
  
  // Guardar puntajes en el estado para que renderPlayersPanel pueda ordenar
  if (!state.playerScores) state.playerScores = {};
  
  // Encontrar jugador líder
  let maxScore = -1;
  let leaderSeat = -1;
  
  for (let i = 0; i < state.totalPlayers; i++) {
    const scoreKey = `player${i + 1}`;
    const playerScore = scores[scoreKey] ?? 0;
    state.playerScores[i] = playerScore;
    
    console.log(`[scores] Jugador ${i}: scoreKey=${scoreKey}, score=${playerScore}`);
    
    if (playerScore > maxScore) {
      maxScore = playerScore;
      leaderSeat = i;
    }
  }
  
  // Re-renderizar el panel completo con los jugadores ordenados
  renderPlayersPanel();
  
  // Actualizar coronas después de re-renderizar
  setTimeout(() => {
    for (let i = 0; i < state.totalPlayers; i++) {
      const playerCrownEl = document.querySelector(`.user[data-player-seat="${i}"] .corona`);
      if (playerCrownEl) {
        if (i === leaderSeat && maxScore > 0) {
          playerCrownEl.style.display = 'block';
        } else {
          playerCrownEl.style.display = 'none';
        }
      }
    }
  }, 100);
  
  console.log('[players] Puntajes actualizados y panel reordenado:', scores);
  
  // Log del ordenamiento después de renderizar
  setTimeout(() => {
    const playerElements = document.querySelectorAll('.info .user');
    const order = Array.from(playerElements).map(el => {
      const name = el.querySelector('.nombre__user')?.textContent || 'N/A';
      const score = el.querySelector('.punto')?.textContent || '0P';
      return `${name} (${score})`;
    }).join(', ');
    console.log('[players] Orden final en el DOM:', order);
  }, 150);
}

async function getBagCount(gameId, seat) {
  try {
    const data = await fetchJSON(`${getApiBase()}/api/game/bag/${gameId}/${seat}`);
    return Array.isArray(data.bag) ? data.bag.length : 0;
  } catch (_) {
    return 0;
  }
}

async function checkAndShowGameOver() {
  // Verificar si TODOS los jugadores terminaron sus bolsas
  const bagCounts = await Promise.all(
    Array.from({ length: state.totalPlayers }, (_, i) => getBagCount(state.gameId, i))
  );
  
  const allEmpty = bagCounts.every(count => count === 0);
  
  if (allEmpty) {
    // Detener timer y polling
    clearInterval(state.timer);
    state.timer = null;
    stopPolling();
    
    let scores = {};
    let trexCounts = {};
    try {
      const data = await fetchJSON(`${getApiBase()}/api/game/scores/${state.gameId}`);
      if (data?.success) {
        scores = data.scores || {};
        trexCounts = data.trex_counts || {};
      }
    } catch (_) {}

    // Determinar ganador usando desempate por T-Rex
    // Primero ordenar por puntaje, luego por T-Rex en caso de empate
    const players = [];
    for (let i = 0; i < state.totalPlayers; i++) {
      const scoreKey = `player${i + 1}`;
      const playerScore = scores[scoreKey] ?? 0;
      const playerTrexCount = trexCounts[scoreKey] ?? 0;
      
      players.push({
        seat: i,
        score: playerScore,
        trexCount: playerTrexCount,
        name: state.playerNames[i] || `JUGADOR ${i + 1}`
      });
    }
    
    // Ordenar: primero por puntaje (mayor a menor), luego por T-Rex (mayor a menor)
    players.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Mayor puntaje primero
      }
      // Si hay empate en puntos, usar T-Rex como desempate
      return b.trexCount - a.trexCount; // Mayor cantidad de T-Rex primero
    });
    
    // El ganador es el primero en la lista ordenada
    const winner = players[0];
    
    let title = "¡FIN DEL JUEGO!";
    let message = "";
    
    const topScore = winner.score;
    const topTrexCount = winner.trexCount;
    const tiedPlayers = players.filter(p => p.score === topScore && p.trexCount === topTrexCount);
    
    if (tiedPlayers.length === 1) {
      // Hay un único ganador
      message = `<div class="winner-section">`;
      message += `<h3>🏆 ${winner.name.toUpperCase()} ES EL GANADOR!</h3>`;
      message += `<p class="score-display">${winner.score} PUNTOS</p>`;
      if (winner.trexCount > 0) {
        message += `<p class="trex-info">🦖 ${winner.trexCount} T-Rex en su tablero</p>`;
      }
      message += `</div>`;
      message += `<h4>📊 CLASIFICACIÓN FINAL</h4>`;
      message += `<ul class="final-scores">`;
      
      players.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎮';
        const trexInfo = player.trexCount > 0 ? ` <span style="color: #ff8c00; font-size: 0.9em; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);">(${player.trexCount} T-Rex)</span>` : '';
        message += `<li><span class="player-medal">${medal}</span> <span class="player-name">${player.name}</span> <span class="player-score">${player.score}P</span>${trexInfo}</li>`;
      });
      message += `</ul>`;
    } else {
      // Empate incluso después del desempate por T-Rex (muy improbable pero posible)
      message = `<div class="winner-section">`;
      message += `<h3>🤝 ¡EMPATE ÉPICO!</h3>`;
      message += `</div>`;
      message += `<h4>Jugadores empatados:</h4>`;
      message += `<ul class="final-scores">`;
      tiedPlayers.forEach(player => {
        message += `<li><span class="player-name">${player.name}</span> <span class="player-score">${player.score}P</span> <span style="color: #ff8c00; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);">(${player.trexCount} T-Rex)</span></li>`;
      });
      message += `</ul>`;
      message += `<p><small>Increíble! Un empate perfecto incluso después del desempate por T-Rex 🎉</small></p>`;
    }

    showGameOverModal(title, message);
  }
}

function showGameOverModal(titleText, messageHtml) {
  const modal = document.getElementById("game-over-modal");
  if (!modal) return;
  const titleEl = modal.querySelector("h2");
  const contentEl = document.getElementById("final-scores");
  const btn = document.getElementById("close-modal-btn");
  if (titleEl) titleEl.textContent = titleText || "¡Fin del juego!";
  if (contentEl) contentEl.innerHTML = messageHtml;
  if (btn) {
    btn.textContent = "Volver al menú";
    btn.onclick = () => {
      window.location.href = PAGES.menu;
    };
  }
  modal.style.display = "flex";
}

// ===========================
// BOTÓN PARA LANZAR DADO
// ===========================

function setupDiceButton() {
  const rollBtn = document.getElementById('roll-dice-btn');
  if (rollBtn) {
    // Remover listeners anteriores clonando el elemento
    const newBtn = rollBtn.cloneNode(true);
    rollBtn.parentNode.replaceChild(newBtn, rollBtn);
    
    newBtn.addEventListener('click', (e) => {
      // Detectar modo multiplayer
      const isMultiplayer = isMultiplayerMode();
      
      // Si el botón está deshabilitado, mostrar mensaje apropiado
      if (newBtn.disabled) {
        console.log('[dice] ❌ Intento de click en botón deshabilitado - mostrando mensaje');
        
        // Determinar el motivo por el que está deshabilitado
        let isMyTurn = false;
        if (isMultiplayer) {
          isMyTurn = state.playerSeat === state.activeSeat;
        } else {
          isMyTurn = state.viewingBoardOf === state.activeSeat;
        }
        const hasAlreadyRolledThisTurn = state.diceRolled && state.diceRolledBySeat === state.activeSeat;
        
        if (!isMyTurn) {
          const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
          if (isMultiplayer) {
            showNotification(`⏳ No es tu turno. Es el turno de ${activePlayerName}. Espera tu turno.`, "warning");
          } else {
            showNotification(`⏳ Debes ver el tablero de ${activePlayerName} para tirar el dado.`, "warning");
          }
        } else if (hasAlreadyRolledThisTurn) {
          showNotification("Ya lanzaste el dado en este turno", "warning");
        } else {
          showNotification("⏳ No puedes tirar el dado en este momento", "warning");
        }
        
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // para dar feedback inmediato antes de llamar a rollDice()
      console.log('[dice] ✅ Botón de dado clickeado - validación pasada');
      rollDice();
    });
    console.log('[dice] Botón de dado configurado correctamente con validaciones');
  } else {
    console.warn('[dice] No se encontró el botón de dado');
  }
}

/**
 * Actualiza la visibilidad del botón del dado
 * RF12: El jugador activo debe poder tirar el dado
 * Para modo local (un jugador controla a todos), siempre mostrar el botón al activo
 */
function updateDiceButtonVisibility() {
  const rollBtn = document.getElementById('roll-dice-btn');
  if (!rollBtn) {
    console.warn('[dice] No se encontró el botón del dado');
    return;
  }
  
  const isMultiplayer = isMultiplayerMode();
  
  let isMyTurn = false;
  if (isMultiplayer) {
    isMyTurn = state.playerSeat === state.activeSeat;
  } else {
    if (state.viewingBoardOf !== state.activeSeat && state.activeSeat !== null && state.activeSeat !== undefined) {
      const oldViewingBoardOf = state.viewingBoardOf;
      state.viewingBoardOf = state.activeSeat;
      console.log('[dice] Sincronizando viewingBoardOf con activeSeat:', oldViewingBoardOf, '→', state.activeSeat);
    }
    isMyTurn = state.viewingBoardOf === state.activeSeat;
  }
  
  const hasAlreadyRolledThisTurn = state.diceRolled && state.diceRolledBySeat === state.activeSeat;
  const shouldEnable = isMyTurn && !hasAlreadyRolledThisTurn;
  
  rollBtn.style.display = 'block';
  rollBtn.style.visibility = 'visible';
  rollBtn.style.opacity = '1';
  
  if (shouldEnable) {
    rollBtn.disabled = false;
    rollBtn.style.pointerEvents = 'auto';
    rollBtn.style.cursor = 'pointer';
    rollBtn.classList.remove('disabled');
    
    if (state.diceRolled && state.diceRolledBySeat !== state.activeSeat) {
      rollBtn.title = 'Lanza el dado para reemplazar la restricción del turno anterior';
    } else {
      rollBtn.title = 'Lanza el dado para comenzar tu turno';
    }
  } else {
    // Botón deshabilitado - visible pero no usable
    rollBtn.disabled = true;
    rollBtn.style.pointerEvents = 'auto'; // Permitir eventos para mostrar mensaje
    rollBtn.style.cursor = 'not-allowed';
    rollBtn.style.opacity = '0.6'; // Hacer visible pero con opacidad reducida
    rollBtn.classList.add('disabled');
    
    if (!isMyTurn) {
      const activePlayerName = state.playerNames[state.activeSeat] || `JUGADOR ${state.activeSeat + 1}`;
      if (isMultiplayer) {
        rollBtn.title = `No es tu turno. Es el turno de ${activePlayerName}. Espera tu turno.`;
      } else {
        rollBtn.title = `Debes ver el tablero de ${activePlayerName} para tirar el dado`;
      }
    } else {
      rollBtn.title = 'Ya lanzaste el dado en este turno';
    }
  }
}

// INICIALIZACIÓN

document.addEventListener("DOMContentLoaded", async () => {
  const userId = obtenerIdUsuario();
  const username = obtenerNombreUsuario();
  
  if (!userId || !username) {
    console.warn('[auth] No hay usuario logueado, redirigiendo...');
    alert('Debes iniciar sesión para jugar');
    window.location.href = PAGES.login;
    return;
  }
  
  // Mostrar nombre de usuario
  const usernameEl = document.getElementById('username');
  if (usernameEl) {
    usernameEl.textContent = username.toUpperCase();
    usernameEl.style.cursor = 'pointer';
    usernameEl.title = 'CLICK PARA CERRAR SESIÓN';
    
    // Agregar evento de click para logout
    usernameEl.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión? Se perderá el progreso del juego actual.')) {
        cerrarSesion();
      }
    });
  }
  
  console.log('[auth] Usuario conectado:', username);
  
  const params = new URLSearchParams(window.location.search);
  const fromQS = params.get("game_id");
  const fromLS = localStorage.getItem("currentGameId");
  const gameId = parseInt(fromQS || fromLS || "0", 10);
  
  if (!gameId) {
    alert("No se encontró game_id. Volviendo al menú.");
    window.location.href = PAGES.menu;
    return;
  }
  
  state.gameId = gameId;

  console.log('[init] Iniciando juego:', gameId);
  
  // Cargar datos de la sala (jugadores, dirección)
  await loadRoomData();
  
  console.log('[init] DESPUÉS de loadRoomData:', {
    totalPlayers: state.totalPlayers,
    direction: state.gameDirection,
    playerNames: state.playerNames
  });
  
  // Determinar asiento del jugador
  state.playerSeat = await determineSeat(gameId);
  
  let boardType = 'primavera'; // Default
  try {
    const initialState = await fetchJSON(`${getApiBase()}/api/game/state/${gameId}`);
    if (initialState?.game_state) {
      state.activeSeat = initialState.game_state.active_seat ?? initialState.game_state.activeSeat ?? 0;
      state.lastKnownActiveSeat = state.activeSeat;
      console.log('[init] activeSeat inicial:', state.activeSeat);
      
      // Obtener board_type
      if (initialState.game_state.board_type) {
        boardType = initialState.game_state.board_type;
        console.log('[init] Board type obtenido del backend:', boardType);
      } else {
        boardType = localStorage.getItem('boardType') || 'primavera';
        console.log('[init] Board type obtenido de localStorage:', boardType);
      }
      
      // SINCRONIZAR ESTADO DEL DADO DESDE EL BACKEND AL INICIALIZAR
      if (initialState.game_state.last_die_roll && initialState.game_state.last_die_roll.die_face) {
        // Mapeo inverso: backend → frontend
        const backendToFrontendDiceMapping = {
          'FOREST': 'bosque',           // RF34: Árboles Comunes
          'ROCKS': 'llanura',           // RF35: Manzanos
          'LEFT_SIDE': 'cafeteria',     // RF37: Cafeterías
          'RIGHT_SIDE': 'banos',        // RF36: Baños
          'EMPTY': 'vacio',             // RF38: Recinto Vacío
          'NO_TREX': 'no-trex'          // RF39: Recinto sin T-REX
        };
        
        const backendDieFace = initialState.game_state.last_die_roll.die_face;
        const frontendDieFace = backendToFrontendDiceMapping[backendDieFace];
        const affectedSeatFromBackend = initialState.game_state.last_die_roll.affected_player_seat ?? initialState.game_state.last_die_roll.affectedSeat;
        
        if (frontendDieFace) {
          console.log('[init] Sincronizando estado del dado desde backend:', {
            backendDieFace,
            frontendDieFace,
            affectedSeatFromBackend
          });
          
          state.currentDice = frontendDieFace;
          state.diceRolled = true;
          state.diceRolledBySeat = affectedSeatFromBackend;
        }
      }
    }
  } catch (e) {
    console.warn('[init] No se pudo obtener estado inicial del backend:', e.message);
    state.activeSeat = 0; // Fallback
    boardType = localStorage.getItem('boardType') || 'primavera';
  }
  
  // Inicializar viewingBoardOf con el activeSeat (vemos el tablero del jugador activo)
  state.viewingBoardOf = state.activeSeat;
  
  // Guardar en localStorage para futuras referencias
  localStorage.setItem('boardType', boardType);
  applyBoardTheme(boardType);
  console.log('[init] Tablero aplicado:', boardType);
  
  console.log('[init] Configuración final:', {
    gameId: state.gameId,
    playerSeat: state.playerSeat,
    activeSeat: state.activeSeat,
    totalPlayers: state.totalPlayers,
    direction: state.gameDirection,
    players: state.playerNames
  });

  // Setup botón de dado
  setupDiceButton();
  
  // Render inicial
  await reloadView();
  
  // Adjuntar handlers
  attachDropHandlers();
  
  // Iniciar polling para sincronización multi-jugador
  startPolling();
  
  // reloadView() ya llama a updateDiceButtonVisibility() y setupDiceButton(), 
  // pero lo hacemos aquí también para asegurar que esté correcto después del polling
  updateDiceButtonVisibility();
  
  console.log('[init] ✅ Juego inicializado correctamente');
});