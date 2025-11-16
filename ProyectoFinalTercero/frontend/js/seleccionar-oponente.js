"use strict";

import { obtenerIdUsuario, obtenerNombreUsuario, PAGES, buildPageUrl } from "./auth.js";

import ApiConfig from "./api-config.js";
// Usar el sistema de configuración de API
const getApiBase = () => window.getApiBase ? window.getApiBase() : "http://localhost:8000";

async function fetchJSON(url, options = {}) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return resp.json();
}

function setStatus(msg, type = "info") {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `status ${type}`;
}

let cachedOpponents = [];

function renderLocalQuickCard(list) {
  const card = document.createElement("div");
  card.className = "opponent-card opponent-card--local";

  const header = document.createElement("div");
  header.className = "opponent-header";

  const avatar = document.createElement("div");
  avatar.className = "opponent-avatar opponent-avatar--local";
  avatar.innerHTML = `<i class="fas fa-gamepad"></i>`;

  const info = document.createElement("div");
  info.className = "opponent-info";
  info.innerHTML = `
    <div class="opponent-name">Modo Local</div>
    <div class="opponent-status opponent-status--local">
      <i class="fas fa-user-friends"></i> Controla ambos tableros desde este dispositivo
    </div>
  `;

  header.appendChild(avatar);
  header.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "opponent-actions opponent-actions--local";

  const btn = document.createElement("button");
  btn.className = "btn-opponent btn-opponent--local";
  btn.innerHTML = `<i class="fas fa-play"></i> Jugar en Local`;
  btn.addEventListener("click", () => startLocalQuickGame());

  actions.appendChild(btn);
  card.appendChild(header);
  card.appendChild(actions);
  list.appendChild(card);
}

function renderOpponents(opponents) {
  const list = document.getElementById("opponents");
  const empty = document.getElementById("empty");
  if (!list || !empty) return;

  list.innerHTML = "";
  renderLocalQuickCard(list);
  if (!opponents || opponents.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  opponents.forEach((o) => {
    const card = document.createElement("div");
    card.className = "card";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = o.username || `Usuario #${o.user_id}`;

    const actions = document.createElement("div");
    actions.className = "actions";

    const btn = document.createElement("button");
    btn.textContent = "Jugar";
    btn.className = "btn btn-primary";
    btn.addEventListener("click", () => onStartGame(o));

    actions.appendChild(btn);
    card.appendChild(name);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

async function loadOpponents() {
  try {
    console.log('[opponents] 🔍 Iniciando loadOpponents...');
    console.log('[opponents] localStorage userId:', localStorage.getItem('userId'));
    console.log('[opponents] localStorage username:', localStorage.getItem('username'));
    
    const myId = obtenerIdUsuario();
    console.log('[opponents] myId obtenido:', myId);
    
    if (!myId) {
      console.error('[opponents] ❌ No hay userId, redirigiendo a login');
      setStatus("No hay sesión. Redirigiendo...", "error");
      setTimeout(() => (window.location.href = PAGES.login), 800);
      return;
    }
    
    // Actualizar nombre de usuario en el DOM
    const username = obtenerNombreUsuario() || `Usuario #${myId}`;
    console.log('[opponents] Username obtenido:', username);
    
    let attempts = 0;
    const maxAttempts = 20; // Aumentado a 20 intentos (2 segundos)
    const updateUsername = () => {
      attempts++;
      const nameEl = document.getElementById("nombre-usuario");
      if (nameEl) {
        let span = nameEl.querySelector('span');
        if (!span) {
          nameEl.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username}</span>`;
          console.log('[opponents] ✅ Usuario actualizado en HTML:', username);
        } else {
          span.textContent = username;
          console.log('[opponents] ✅ Usuario actualizado en span:', username);
        }
        // Configurar dropdown después de actualizar el nombre
        setupUserDropdown();
        return true;
      } else if (attempts < maxAttempts) {
        console.log(`[opponents] ⏳ Intento ${attempts}/${maxAttempts}: elemento nombre-usuario no encontrado, reintentando...`);
        setTimeout(updateUsername, 100);
        return false;
      } else {
        console.error('[opponents] ❌ No se pudo encontrar el elemento nombre-usuario después de', maxAttempts, 'intentos');
        console.error('[opponents] Elementos disponibles:', {
          nombreUsuario: document.getElementById('nombre-usuario'),
          userDropdown: document.getElementById('userDropdown'),
          allButtons: document.querySelectorAll('button[id*="usuario"]')
        });
        return false;
      }
    };
    
    updateUsername();

    setStatus("Cargando oponentes...", "info");
    const data = await fetchJSON(`${getApiBase()}/api/user/opponents/${myId}`);
    if (!data || data.success === false) {
      setStatus(data?.message || "No se pudo cargar la lista", "error");
      return;
    }
    const opponents = Array.isArray(data.opponents) ? data.opponents : [];
    cachedOpponents = opponents;
    setStatus(
      opponents.length ? "" : "No hay oponentes disponibles",
      opponents.length ? "info" : "error"
    );
    renderOpponents(opponents);
  } catch (e) {
    console.error("[opponents] Error: ", e);
    setStatus("Error cargando oponentes.", "error");
  }
}

async function onStartGame(opponent) {
  try {
    const myId = obtenerIdUsuario();
    if (!myId) {
      setStatus("Sesión expirada.", "error");
      return;
    }
    localStorage.removeItem("localGameMode");
    setStatus(
      `Creando partida con ${
        opponent.username || "Usuario #" + opponent.user_id
      }...`,
      "info"
    );
    const body = { player1_id: myId, player2_id: opponent.user_id };
    const res = await fetchJSON(`${getApiBase()}/api/game/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res || res.success === false || !res.game_id) {
      setStatus(res?.message || "No se pudo crear la partida", "error");
      return;
    }
    localStorage.setItem("currentGameId", String(res.game_id));
    window.location.href = buildPageUrl(PAGES.juego, { game_id: res.game_id });
  } catch (e) {
    console.error("[start] Error: ", e);
    setStatus("Error al crear la partida.", "error");
  }
}

function selectLocalOpponent(opponents) {
  if (!Array.isArray(opponents) || opponents.length === 0) return null;
  const preferred = opponents.find(o => (o.username || "").toUpperCase().includes("ICESTUDIO"));
  return preferred || opponents[0];
}

async function ensureOpponents(myId) {
  if (cachedOpponents.length > 0) return cachedOpponents;
  try {
    const data = await fetchJSON(`${getApiBase()}/api/user/opponents/${myId}`);
    if (data && data.success && Array.isArray(data.opponents)) {
      cachedOpponents = data.opponents;
      return cachedOpponents;
    }
  } catch (error) {
    console.error("[local] Error cargando oponentes:", error);
  }
  return [];
}

async function startLocalQuickGame() {
  try {
    const myId = obtenerIdUsuario();
    if (!myId) {
      setStatus("Sesión expirada.", "error");
      return;
    }

    setStatus("Creando partida local...", "info");

    const opponents = await ensureOpponents(myId);
    const opponent = selectLocalOpponent(opponents);

    if (!opponent) {
      setStatus("No hay jugadores de prueba disponibles para modo local.", "error");
      return;
    }

    const currentPlayerName = (obtenerNombreUsuario() || "JUGADOR 1").toUpperCase();
    const opponentDisplayName = (opponent.username || "JUGADOR 2").toUpperCase();

    const res = await fetchJSON(`${getApiBase()}/api/game/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player1_id: myId,
        player2_id: opponent.user_id
      }),
    });

    if (!res || res.success === false || !res.game_id) {
      setStatus(res?.message || "No se pudo crear la partida local", "error");
      return;
    }

    localStorage.setItem("currentGameId", String(res.game_id));
    localStorage.setItem("localGameMode", "true");
    localStorage.setItem("totalPlayers", "2");
    localStorage.setItem("gameDirection", localStorage.getItem("gameDirection") || "clockwise");
    localStorage.setItem("playerNames", JSON.stringify({
      0: currentPlayerName,
      1: opponentDisplayName
    }));
    if (!localStorage.getItem("boardType")) {
      localStorage.setItem("boardType", "primavera");
    }

    setStatus("Partida local creada. Redirigiendo...", "success");
    setTimeout(() => {
      window.location.href = buildPageUrl(PAGES.juego, { game_id: res.game_id, mode: 'local' });
    }, 300);
  } catch (error) {
    console.error("[local] Error al iniciar partida local:", error);
    setStatus("Error al iniciar partida local.", "error");
  }
}

function setupUserDropdown() {
  const userButton = document.getElementById('nombre-usuario');
  const dropdown = document.getElementById('userDropdown');
  const btnLogout = document.getElementById('btn-logout');
  
  if (!userButton || !dropdown) {
    console.warn('[opponents] ⚠️ Elementos del dropdown no encontrados');
    return;
  }

  // Configurar click en el botón de usuario
  userButton.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('active');
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', function(e) {
    if (!userButton.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  // Configurar logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('¿Deseas cerrar sesión?')) {
        const { cerrarSesion } = await import('./auth.js');
        cerrarSesion();
      }
    });
  }

  console.log('[opponents] ✅ Dropdown configurado correctamente');
}

document.addEventListener("DOMContentLoaded", () => {
  localStorage.removeItem("localGameMode");
  loadOpponents();
});
