import { obtenerIdUsuario, obtenerNombreUsuario, cerrarSesion, esInvitado, PAGES, buildPageUrl } from './auth.js';
import ApiConfig from './api-config.js';

// Usar el sistema de configuración de API
const getApiBase = () => window.getApiBase ? window.getApiBase() : 'http://localhost:8000';

class WaitingRoom {
    constructor() {
        this.roomCode = null;
        this.isAdmin = false;
        this.mode = 'create'; // 'create' o 'join'
        // init() se llamará desde DOMContentLoaded porque es async
    }

    isValidRoomCode(code) {
        return typeof code === 'string' && /^[A-Z0-9]{4,10}$/i.test(code.trim());
    }

    async init() {
        await this.setupUserInfo();
        this.detectMode();
        this.setupEventListeners();
        this.cleanupPreviousGame();
        
        if (this.mode === 'create') {
            this.generateRandomRoomCode();
        }
    }

    detectMode() {
        const isGuest = esInvitado();
        
        // Detectar si venimos de unirse a una sala (parámetro en URL o localStorage)
        const urlParams = new URLSearchParams(window.location.search);
        const joinFlag = urlParams.get('join');
        const paramRoomCode = urlParams.get('code') || urlParams.get('room_code');
        const joinCode = this.isValidRoomCode(paramRoomCode) ? paramRoomCode : null;
        const savedRoomCodeRaw = localStorage.getItem('joinRoomCode');
        const savedRoomCode = this.isValidRoomCode(savedRoomCodeRaw) ? savedRoomCodeRaw : null;
        if (savedRoomCodeRaw && !savedRoomCode) {
            localStorage.removeItem('joinRoomCode');
        }
        
        const joinRequested = ['true', '1', 'yes'].includes((joinFlag || '').toLowerCase());
        
        if (isGuest || joinRequested || joinCode || savedRoomCode) {
            // Invitados siempre están en modo 'join'
            this.mode = 'join';
            this.roomCode = joinCode || savedRoomCode;
            if (this.roomCode) {
                const input = document.getElementById('roomCode');
                if (input) {
                    input.value = this.roomCode.toUpperCase();
                    this.validateRoomCode();
                }
            } else if (joinRequested) {
                this.showStatus('Ingresa el código de la sala para unirte', 'info');
            }
        } else {
            this.mode = 'create';
        }
        
        // Actualizar UI según el modo
        this.updateUIForMode();
    }

    updateUIForMode() {
        const createBtn = document.getElementById('createRoomBtn');
        const joinBtn = document.getElementById('joinRoomBtn');
        const configForm = document.getElementById('config-form');
        const title = document.querySelector('.card-header h3');
        const subtitle = document.querySelector('.card-header .subtitle');
        
        const isGuest = esInvitado();
        if (isGuest) {
            this.mode = 'join';
        }
        
        if (this.mode === 'join' || isGuest) {
            // Cambiar a modo unirse
            if (title) title.innerHTML = '<i class="fas fa-sign-in-alt"></i> Unirse a Sala';
            if (subtitle) subtitle.textContent = 'Ingresa el código de la sala para unirte';
            if (createBtn) {
                createBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Unirse a Sala';
                createBtn.id = 'joinRoomBtn';
            }
            
            // Ocultar campos que no son necesarios para unirse
            const playerCountGroup = document.getElementById('playerCount')?.closest('.form-group');
            const directionGroup = document.getElementById('gameDirection')?.closest('.form-group');
            const boardTypeGroup = document.getElementById('boardType')?.closest('.form-group');
            const regenerateBtn = document.getElementById('regenerateCodeBtn');
            const testPlayersBtn = document.getElementById('addTestingPlayersBtn');
            
            if (playerCountGroup) playerCountGroup.style.display = 'none';
            if (directionGroup) directionGroup.style.display = 'none';
            if (boardTypeGroup) boardTypeGroup.style.display = 'none';
            if (regenerateBtn) regenerateBtn.style.display = 'none';
            if (testPlayersBtn) testPlayersBtn.style.display = 'none';
            
            // Cambiar placeholder del input
            const roomCodeInput = document.getElementById('roomCode');
            if (roomCodeInput) {
                roomCodeInput.placeholder = 'Ingresa el código de la sala';
                roomCodeInput.readOnly = false;
            }
        } else {
            // Modo crear (por defecto)
            if (title) title.innerHTML = '<i class="fas fa-dragon"></i> Configurar Partida';
            if (subtitle) subtitle.textContent = 'Prepara tu sala y espera a los jugadores';
        }
    }

    async setupUserInfo() {
        console.log('[auth] 🔍 Iniciando setupUserInfo...');
        console.log('[auth] localStorage userId:', localStorage.getItem('userId'));
        console.log('[auth] localStorage username:', localStorage.getItem('username'));
        
        let userId = obtenerIdUsuario();
        let username = obtenerNombreUsuario();

        console.log('[auth] Después de obtener funciones:', { userId, username });

        // CRÍTICO: Si es invitado y no tiene user_id válido, crear uno en el backend
        if (esInvitado() && !userId) {
            console.log('[auth] Es invitado sin userId, creando usuario invitado...');
            try {
                const { iniciarSesionInvitado } = await import('./auth.js');
                const result = await iniciarSesionInvitado();
                
                if (!result.success) {
                    console.error('[auth] Error al crear usuario invitado:', result.message);
                    this.showStatus('Error al crear usuario invitado: ' + (result.message || 'Error desconocido'), 'error');
                    setTimeout(() => {
                        window.location.href = PAGES.login;
                    }, 2000);
                    return;
                }
                
                userId = result.user.id;
                username = result.user.username;
                console.log('[auth] ✅ Usuario invitado creado:', { userId, username });
            } catch (error) {
                console.error('[auth] Error al crear usuario invitado:', error);
                this.showStatus('Error al crear usuario invitado', 'error');
                setTimeout(() => {
                    window.location.href = PAGES.login;
                }, 2000);
                return;
            }
        }

        if (!userId || !username) {
            console.error('[auth] ❌ No hay usuario logueado:', { userId, username });
            console.error('[auth] localStorage completo:', {
                userId: localStorage.getItem('userId'),
                username: localStorage.getItem('username'),
                isGuest: localStorage.getItem('isGuest')
            });
            console.warn('[auth] No hay usuario logueado, redirigiendo...');
            this.showStatus('Debes iniciar sesión para continuar', 'error');
            setTimeout(() => {
                window.location.href = PAGES.login;
            }, 2000);
            return;
        }

        // Intentar actualizar el nombre de usuario en el DOM
        // Intentar múltiples veces porque el DOM puede no estar listo
        let attempts = 0;
        const maxAttempts = 20; // Aumentado a 20 intentos (2 segundos)
        const updateUsername = () => {
            attempts++;
            const userButton = document.getElementById('nombre-usuario');
            if (userButton) {
                const span = userButton.querySelector('span');
                if (span) {
                    span.textContent = username;
                    console.log('[auth] ✅ Usuario actualizado en span:', username);
                } else {
                    userButton.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username}</span>`;
                    console.log('[auth] ✅ Usuario actualizado en HTML:', username);
                }
                // Configurar el dropdown después de actualizar el nombre
                this.setupUserDropdown();
                return true;
            } else if (attempts < maxAttempts) {
                console.log(`[auth] ⏳ Intento ${attempts}/${maxAttempts}: elemento nombre-usuario no encontrado, reintentando...`);
                setTimeout(updateUsername, 100);
                return false;
            } else {
                console.error('[auth] ❌ No se pudo encontrar el elemento nombre-usuario después de', maxAttempts, 'intentos');
                console.error('[auth] Elementos disponibles en el DOM:', {
                    userButton: document.getElementById('nombre-usuario'),
                    userDropdown: document.getElementById('userDropdown'),
                    allButtons: document.querySelectorAll('button[id*="usuario"]')
                });
                return false;
            }
        };
        
        updateUsername();

        console.log('[auth] ✅ Usuario conectado:', username, '| ID:', userId);
    }

    setupUserDropdown() {
        const userButton = document.getElementById('nombre-usuario');
        const dropdown = document.getElementById('userDropdown');
        const btnLogout = document.getElementById('btn-logout');
        
        if (!userButton || !dropdown) {
            console.warn('[auth] ⚠️ Elementos del dropdown no encontrados');
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
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('¿Deseas cerrar sesión?')) {
                    cerrarSesion();
                }
            });
        }

        console.log('[auth] ✅ Dropdown configurado correctamente');
    }

    generateRandomRoomCode() {
        const roomCodeInput = document.getElementById('roomCode');
        const regenerateBtn = document.getElementById('regenerateCodeBtn');
        
        if (!roomCodeInput) return;

        if (regenerateBtn) {
            regenerateBtn.querySelector('i').classList.add('rotating');
        }

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        roomCodeInput.value = code;
        this.validateRoomCode();

        setTimeout(() => {
            if (regenerateBtn) {
                regenerateBtn.querySelector('i').classList.remove('rotating');
            }
        }, 500);
    }

    setupEventListeners() {
        const roomCodeInput = document.getElementById('roomCode');
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', () => this.validateRoomCode());
        }

        const regenerateBtn = document.getElementById('regenerateCodeBtn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => this.generateRandomRoomCode());
        }

        ['playerCount', 'gameDirection', 'boardType'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.checkFormValidity());
        });

        const createBtn = document.getElementById('createRoomBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (this.mode === 'join') {
                    this.joinRoom();
                } else {
                    this.createRoom();
                }
            });
        }
        
        // Botón de unirse (si existe)
        const joinBtn = document.getElementById('joinRoomBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinRoom());
        }

        const backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.addEventListener('click', () => this.goBack());

        const leaveBtn = document.getElementById('leaveRoomBtn');
        if (leaveBtn) leaveBtn.addEventListener('click', () => this.leaveRoom());

        // Botón de copiar código
        const copyCodeBtn = document.getElementById('copyCodeBtn');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        }

        // El logout se configura en setupUserDropdown() para evitar duplicados
    }

    validateRoomCode() {
        const input = document.getElementById('roomCode');
        if (!input) return;

        const code = input.value.trim().toUpperCase();
        input.value = code;
        
        const isValid = /^[A-Z0-9]{4,10}$/.test(code);
        input.classList.remove('is-valid', 'is-invalid');
        
        if (code.length > 0) {
            input.classList.add(isValid ? 'is-valid' : 'is-invalid');
        }

        this.checkFormValidity();
    }

    checkFormValidity() {
        const roomCode = document.getElementById('roomCode')?.value || '';
        const createBtn = document.getElementById('createRoomBtn');
        const joinBtn = document.getElementById('joinRoomBtn');
        const btn = createBtn || joinBtn;

        if (!btn) return;

        const isValidCode = /^[A-Z0-9]{4,10}$/.test(roomCode);
        
        if (this.mode === 'join') {
            // Para unirse solo necesitamos el código
            btn.disabled = !isValidCode;
        } else {
            // Para crear necesitamos todos los campos
            const playerCount = document.getElementById('playerCount')?.value || '';
            const gameDirection = document.getElementById('gameDirection')?.value || '';
            const boardType = document.getElementById('boardType')?.value || '';
            btn.disabled = !(playerCount && gameDirection && boardType && isValidCode);
        }
    }

    async createRoom() {
        if (esInvitado()) {
            this.showStatus('Los invitados solo pueden unirse a salas con código. Por favor, usa el botón "Unirse a Sala"', 'error');
            // Redirigir automáticamente al modo unirse
            this.mode = 'join';
            this.updateUIForMode();
            return;
        }
        
        const playerCountEl = document.getElementById('playerCount');
        const directionEl = document.getElementById('gameDirection');
        const roomCodeEl = document.getElementById('roomCode');
        
        if (!playerCountEl || !directionEl || !roomCodeEl) {
            this.showStatus('Error: Campos no encontrados', 'error');
            return;
        }

        const playerCount = parseInt(playerCountEl.value);
        const direction = directionEl.value;
        const roomCode = roomCodeEl.value.trim().toUpperCase();
        const userId = obtenerIdUsuario();

        if (!userId) {
            this.showStatus('Debes iniciar sesión', 'error');
            window.location.href = PAGES.login;
            return;
        }

        if (isNaN(playerCount) || playerCount < 2 || playerCount > 5) {
            this.showStatus('El número de jugadores debe ser entre 2 y 5', 'error');
            return;
        }

        if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) {
            this.showStatus('Código de sala inválido', 'error');
            return;
        }

        try {
            this.showLoading('Creando sala...');

            const response = await fetch(`${getApiBase()}/api/room/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    room_code: roomCode,
                    max_players: playerCount,
                    game_direction: direction
                }),
                credentials: 'include'
            });

            // Verificar si la respuesta es JSON válido
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[room] Respuesta no JSON al crear sala:', text);
                throw new Error('El servidor respondió con un formato inesperado. Revisa la consola del servidor.');
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error al crear sala');
            }

            this.roomCode = roomCode;
            this.isAdmin = true;

            const boardType = document.getElementById('boardType')?.value || 'primavera';
            
            localStorage.setItem('currentRoomCode', roomCode);
            localStorage.setItem('isRoomAdmin', 'true');
            localStorage.setItem('maxPlayers', playerCount);
            localStorage.setItem('gameDirection', direction);
            localStorage.setItem('boardType', boardType); // RF24: Guardar selección de tablero

            this.showStatus('¡Sala creada! Agregando jugadores de prueba...', 'success');

            // Ocultar formulario y mostrar información de sala
            const configForm = document.getElementById('config-form');
            const roomInfo = document.getElementById('room-info');
            const playersSection = document.getElementById('playersSection');
            const startBtn = document.getElementById('startGameBtn');
            const leaveBtn = document.getElementById('leaveRoomBtn');

            if (configForm) configForm.style.display = 'none';
            if (roomInfo) {
                document.getElementById('displayRoomCode').textContent = roomCode;
                document.getElementById('displayMaxPlayers').textContent = playerCount;
                document.getElementById('displayDirection').textContent = 
                    direction === 'clockwise' ? 'Horario' : 'Antihorario';
                roomInfo.style.display = 'block';
            }
            if (playersSection) playersSection.style.display = 'block';
            if (startBtn) startBtn.style.display = 'block';
            if (leaveBtn) leaveBtn.style.display = 'block';

            // Configurar listener para el botón de inicio (solo si aún no lo tiene)
            if (startBtn && !startBtn.hasAttribute('data-listener-attached')) {
                startBtn.setAttribute('data-listener-attached', 'true');
                startBtn.addEventListener('click', () => this.startGame());
            }

            // Actualizar lista de jugadores
            await this.updatePlayersList();
            
            // Iniciar polling para actualizar lista de jugadores
            this.startPolling();

            // Mostrar botón de testing para agregar jugadores manualmente si es necesario
            this.addTestPlayersButton();
            this.showStatus('¡Sala creada! Esperando jugadores...', 'success');

        } catch (err) {
            console.error('[room] Error:', err);
            this.showStatus(err.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async joinRoom() {
        const roomCodeEl = document.getElementById('roomCode');
        if (!roomCodeEl) {
            this.showStatus('Error: Campo de código no encontrado', 'error');
            return;
        }

        const roomCode = roomCodeEl.value.trim().toUpperCase();
        let userId = obtenerIdUsuario();

        // CRÍTICO: Si es invitado y no tiene user_id válido, crear uno en el backend
        if (esInvitado() && !userId) {
            try {
                this.showLoading('Creando usuario invitado...');
                const { iniciarSesionInvitado } = await import('./auth.js');
                const result = await iniciarSesionInvitado();
                
                if (!result.success) {
                    this.showStatus('Error al crear usuario invitado: ' + (result.message || 'Error desconocido'), 'error');
                    this.hideLoading();
                    return;
                }
                
                userId = result.user.id;
                this.hideLoading();
            } catch (error) {
                console.error('[room] Error al crear usuario invitado:', error);
                this.showStatus('Error al crear usuario invitado', 'error');
                this.hideLoading();
                return;
            }
        }

        if (!userId) {
            this.showStatus('Debes iniciar sesión', 'error');
            window.location.href = PAGES.login;
            return;
        }

        if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) {
            this.showStatus('Código de sala inválido', 'error');
            return;
        }

        try {
            this.showLoading('Uniéndose a la sala...');

            // Primero verificar que la sala existe
            const roomInfoResponse = await fetch(`${getApiBase()}/api/room/${roomCode}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const contentType = roomInfoResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await roomInfoResponse.text();
                console.error('[room] Respuesta no JSON al obtener info de sala:', text);
                throw new Error('El servidor respondió con un formato inesperado');
            }

            const roomInfo = await roomInfoResponse.json();
            
            if (!roomInfo.success) {
                throw new Error(roomInfo.error || 'Sala no encontrada');
            }

            // Verificar que la sala no esté llena
            if (roomInfo.players && roomInfo.players.length >= roomInfo.room.max_players) {
                throw new Error('La sala está llena');
            }

            // Verificar que el usuario no esté ya en la sala
            if (roomInfo.players) {
                const alreadyInRoom = roomInfo.players.some(p => p.user_id == userId);
                if (alreadyInRoom) {
                    throw new Error('Ya estás en esta sala');
                }
            }

            // Unirse a la sala
            const joinResponse = await fetch(`${getApiBase()}/api/room/${roomCode}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
                credentials: 'include'
            });

            const joinContentType = joinResponse.headers.get('content-type');
            if (!joinContentType || !joinContentType.includes('application/json')) {
                const text = await joinResponse.text();
                console.error('[room] Respuesta no JSON al unirse:', text);
                throw new Error('El servidor respondió con un formato inesperado');
            }

            const joinData = await joinResponse.json();
            
            if (!joinData.success) {
                throw new Error(joinData.error || 'Error al unirse a la sala');
            }

            this.roomCode = roomCode;
            this.isAdmin = false; // El que se une no es admin

            // Guardar información de la sala
            localStorage.setItem('currentRoomCode', roomCode);
            localStorage.setItem('isRoomAdmin', 'false');
            localStorage.setItem('maxPlayers', roomInfo.room.max_players);
            localStorage.setItem('gameDirection', roomInfo.room.game_direction);
            
            // Guardar board_type de la sala (todos los jugadores deben usar el mismo)
            if (roomInfo.room && roomInfo.room.board_type) {
                localStorage.setItem('boardType', roomInfo.room.board_type);
                console.log('[room] Board type guardado al unirse a la sala:', roomInfo.room.board_type);
            }

            this.showStatus('¡Te uniste a la sala exitosamente!', 'success');

            // Ocultar formulario y mostrar información de sala
            const configForm = document.getElementById('config-form');
            const roomInfoSection = document.getElementById('room-info');
            const playersSection = document.getElementById('playersSection');
            const leaveBtn = document.getElementById('leaveRoomBtn');

            if (configForm) configForm.style.display = 'none';
            if (roomInfoSection) {
                document.getElementById('displayRoomCode').textContent = roomCode;
                document.getElementById('displayMaxPlayers').textContent = roomInfo.room.max_players;
                document.getElementById('displayDirection').textContent = 
                    roomInfo.room.game_direction === 'clockwise' ? 'Horario' : 'Antihorario';
                roomInfoSection.style.display = 'block';
            }
            if (playersSection) playersSection.style.display = 'block';
            if (leaveBtn) leaveBtn.style.display = 'block';

            // Actualizar lista de jugadores
            await this.updatePlayersList();

            // Iniciar polling para actualizar lista de jugadores
            this.startPolling();

        } catch (err) {
            console.error('[room] Error al unirse:', err);
            this.showStatus(err.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    startPolling() {
        // Actualizar lista de jugadores cada 3 segundos
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        this.pollingInterval = setInterval(() => {
            if (this.roomCode) {
                this.updatePlayersList();
            } else {
                clearInterval(this.pollingInterval);
            }
        }, 3000);
    }

    async startGame() {
        try {
            // Validar que haya al menos 2 jugadores antes de intentar iniciar
            const roomResponse = await fetch(`${getApiBase()}/api/room/${this.roomCode}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const roomData = await roomResponse.json();
            if (roomData.success && roomData.players) {
                if (roomData.players.length < 2) {
                    this.showStatus('Se necesitan al menos 2 jugadores para iniciar', 'error');
                    return;
                }
            }

            this.showLoading('Iniciando partida...');

            const userId = obtenerIdUsuario();
            const startResponse = await fetch(`${getApiBase()}/api/room/${this.roomCode}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
                credentials: 'include'
            });

            // Verificar si la respuesta es JSON válido
            const contentType = startResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await startResponse.text();
                console.error('[room] Respuesta no JSON:', text);
                throw new Error('El servidor respondió con un formato inesperado');
            }

            const startData = await startResponse.json();
            
            if (!startData.success) {
                throw new Error(startData.error || 'Error al iniciar partida');
            }

            const gameId = startData.game_id;
            localStorage.setItem('currentGameId', gameId);
            
            // Guardar información de jugadores para el juego
            const playerCount = roomData.players.length;
            localStorage.setItem('totalPlayers', playerCount);
            
            // Guardar nombres de jugadores
            const playerNames = {};
            roomData.players.forEach((player, index) => {
                playerNames[index] = player.username;
            });
            localStorage.setItem('playerNames', JSON.stringify(playerNames));
            
            // Guardar board_type de la sala (todos los jugadores deben usar el mismo)
            if (roomData.room && roomData.room.board_type) {
                localStorage.setItem('boardType', roomData.room.board_type);
                console.log('[room] Board type guardado desde sala:', roomData.room.board_type);
            }

            console.log('[room] ✅ Partida iniciada:', gameId);
            console.log('[room] Jugadores guardados:', playerNames);
            console.log('[room] Total jugadores:', playerCount);
            console.log('[room] Verificando localStorage:', {
                totalPlayers: localStorage.getItem('totalPlayers'),
                playerNames: localStorage.getItem('playerNames')
            });

            this.showStatus('¡Partida iniciada! Redirigiendo...', 'success');

            // Detener el polling antes de redirigir
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            setTimeout(() => {
                const juegoUrl = buildPageUrl(PAGES.juego, { game_id: gameId });
                console.log('[room] 🔗 Redirigiendo desde startGame a:', juegoUrl);
                window.location.href = juegoUrl;
            }, 1000);

        } catch (err) {
            console.error('[room] Error al iniciar:', err);
            this.showStatus(err.message, 'error');
            throw err;
        }
    }

    cleanupPreviousGame() {
        const keysToRemove = [
            'maxPlayers', 'gameDirection', 'totalPlayers', 'playerNames',
            'currentGameId', 'currentRoomCode', 'isRoomAdmin', 'firstPlayerName'
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    goBack() {
        this.cleanupPreviousGame();
        window.location.href = PAGES.menu;
    }

    showStatus(message, type = 'info') {
        const alertEl = document.getElementById('statusAlert');
        const textEl = document.getElementById('statusText');

        if (!alertEl || !textEl) {
            console.log(`[${type}] ${message}`);
            return;
        }

        textEl.textContent = message;
        alertEl.className = `status-alert ${type}`;
        alertEl.style.display = 'flex';

        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 5000);
    }

    showLoading(msg) {
        const overlay = document.getElementById('loading-overlay') || this.createLoadingOverlay();
        const text = overlay.querySelector('p');
        if (text) text.textContent = msg;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        `;
        overlay.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; text-align: center;">
                <div class="spinner"></div>
                <p style="margin-top: 15px; color: #333;">Cargando...</p>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    async updatePlayersList() {
        if (!this.roomCode) return;

        try {
            const response = await fetch(`${getApiBase()}/api/room/${this.roomCode}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[room] Respuesta no JSON al obtener jugadores:', text);
                return;
            }

            const data = await response.json();

            if (data.success) {
                // Debug: mostrar información de la sala
                console.log('[room] Estado de la sala:', {
                    status: data.room?.status,
                    game_id: data.room?.game_id,
                    players: data.players?.length
                });
                
                // Verificar si la partida ha comenzado
                // CRÍTICO: Verificar tanto status como game_id para asegurar que la partida realmente comenzó
                const roomStatus = data.room?.status;
                const roomGameId = data.room?.game_id;
                
                console.log('[room] 🔍 Verificando estado de la sala:', {
                    status: roomStatus,
                    game_id: roomGameId,
                    hasRoom: !!data.room,
                    playersCount: data.players?.length
                });
                
                if (data.room && roomStatus === 'IN_PROGRESS' && roomGameId) {
                    console.log('[room] ✅✅✅ Partida iniciada detectada! Redirigiendo al juego...');
                    console.log('[room] game_id:', roomGameId);
                    console.log('[room] room data completa:', JSON.stringify(data.room, null, 2));
                    console.log('[room] players data:', JSON.stringify(data.players, null, 2));
                    
                    // Detener el polling INMEDIATAMENTE para evitar múltiples redirecciones
                    if (this.pollingInterval) {
                        clearInterval(this.pollingInterval);
                        this.pollingInterval = null;
                        console.log('[room] ⏹️ Polling detenido');
                    }
                    
                    // Guardar board_type de la sala si está disponible directamente en la respuesta
                    if (data.room.board_type) {
                        localStorage.setItem('boardType', data.room.board_type);
                        console.log('[room] ✅ Board type guardado desde polling:', data.room.board_type);
                    } else {
                        // Si no está en la respuesta, usar el que ya está en localStorage o el por defecto
                        const existingBoardType = localStorage.getItem('boardType') || 'primavera';
                        localStorage.setItem('boardType', existingBoardType);
                        console.log('[room] ⚠️ Board type no en respuesta, usando:', existingBoardType);
                    }
                    
                    // CRÍTICO: Guardar información inmediatamente antes de redirigir
                    const gameIdToRedirect = parseInt(roomGameId);
                    const playersToRedirect = data.players || [];
                    
                    // Validar que gameId es válido
                    if (!gameIdToRedirect || isNaN(gameIdToRedirect)) {
                        console.error('[room] ❌ game_id inválido:', roomGameId);
                        this.showStatus('Error: ID de partida inválido', 'error');
                        return;
                    }
                    
                    // Guardar información del juego INMEDIATAMENTE
                    localStorage.setItem('currentGameId', gameIdToRedirect.toString());
                    
                    if (playersToRedirect.length > 0) {
                        localStorage.setItem('totalPlayers', playersToRedirect.length.toString());
                        
                        // Guardar nombres de jugadores
                        const playerNames = {};
                        playersToRedirect.forEach((player, index) => {
                            if (player && player.username) {
                                // Usar el player_seat del backend si está disponible, sino usar el índice
                                const seat = player.player_seat !== undefined ? player.player_seat : index;
                                playerNames[seat] = player.username;
                            }
                        });
                        localStorage.setItem('playerNames', JSON.stringify(playerNames));
                        
                        console.log('[room] ✅ Datos guardados:', {
                            gameId: gameIdToRedirect,
                            totalPlayers: playersToRedirect.length,
                            playerNames,
                            boardType: localStorage.getItem('boardType')
                        });
                    } else {
                        console.warn('[room] ⚠️ No hay jugadores en la respuesta, usando valores existentes');
                    }
                    
                    // Redirigir inmediatamente (no esperar operaciones asíncronas)
                    this.showStatus('¡La partida ha comenzado! Redirigiendo...', 'success');
                    
                    // Forzar redirección después de un pequeño delay
                    setTimeout(() => {
                        const juegoUrl = buildPageUrl(PAGES.juego, { game_id: gameIdToRedirect });
                        console.log('[room] 🔗🔗🔗 REDIRIGIENDO A:', juegoUrl);
                        console.log('[room] 📦 localStorage final:', {
                            currentGameId: localStorage.getItem('currentGameId'),
                            totalPlayers: localStorage.getItem('totalPlayers'),
                            playerNames: localStorage.getItem('playerNames'),
                            boardType: localStorage.getItem('boardType')
                        });
                        
                        // Forzar la redirección - usar location.replace para evitar que el usuario pueda volver atrás
                        window.location.replace(juegoUrl);
                    }, 500); // Reducido a 500ms para que sea más rápido
                    return;
                }

                if (data.players) {
                    this.renderPlayersList(data.players);
                    this.updateStartButton(data.players.length);
                }
            }
        } catch (err) {
            console.error('[room] Error al actualizar jugadores:', err);
        }
    }

    async redirectToGame(gameId, players) {
        console.log('[room] 🔄 redirectToGame iniciado');
        console.log('[room] gameId:', gameId);
        console.log('[room] players:', players);
        
        // Detener el polling inmediatamente
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('[room] Polling detenido');
        }

        // Validar que tenemos gameId
        if (!gameId) {
            console.error('[room] ❌ No hay gameId para redirigir');
            this.showStatus('Error: No se pudo obtener el ID de la partida', 'error');
            return;
        }

        // Guardar información del juego PRIMERO (antes de obtener board_type)
        localStorage.setItem('currentGameId', gameId);
        
        // Validar y guardar información de jugadores
        if (players && Array.isArray(players) && players.length > 0) {
            localStorage.setItem('totalPlayers', players.length.toString());
            
            // Guardar nombres de jugadores
            const playerNames = {};
            players.forEach((player, index) => {
                if (player && player.username) {
                    // Usar el player_seat del backend si está disponible, sino usar el índice
                    const seat = player.player_seat !== undefined ? player.player_seat : index;
                    playerNames[seat] = player.username;
                }
            });
            localStorage.setItem('playerNames', JSON.stringify(playerNames));
            
            console.log('[room] ✅ Información guardada:', {
                gameId,
                totalPlayers: players.length,
                playerNames,
                playersData: players
            });
        } else {
            console.warn('[room] ⚠️ No hay información de jugadores en la respuesta');
            console.warn('[room] players recibido:', players);
            
            // Si no hay jugadores en la respuesta, intentar obtenerlos del backend
            // Pero primero redirigir con valores por defecto para no bloquear
            const existingTotalPlayers = localStorage.getItem('totalPlayers');
            if (!existingTotalPlayers) {
                localStorage.setItem('totalPlayers', '2');
                console.log('[room] Usando totalPlayers por defecto: 2');
            }
        }

        // Obtener board_type de la sala (con timeout corto para no bloquear la redirección)
        // Si ya está en localStorage desde el polling, no es necesario obtenerlo de nuevo
        const existingBoardType = localStorage.getItem('boardType');
        if (!existingBoardType) {
            try {
                console.log('[room] Obteniendo board_type de la sala...');
                const boardType = await Promise.race([
                    this.getRoomBoardType(),
                    new Promise((resolve) => setTimeout(() => resolve(null), 1500)) // Timeout de 1.5 segundos
                ]);
                
                if (boardType) {
                    localStorage.setItem('boardType', boardType);
                    console.log('[room] ✅ Board type obtenido:', boardType);
                } else {
                    // Si no se puede obtener, usar el valor por defecto
                    const defaultBoardType = 'primavera';
                    localStorage.setItem('boardType', defaultBoardType);
                    console.log('[room] ⚠️ Usando board_type por defecto:', defaultBoardType);
                }
            } catch (err) {
                console.warn('[room] ⚠️ Error al obtener board_type:', err);
                // Usar valor por defecto si falla
                const defaultBoardType = 'primavera';
                localStorage.setItem('boardType', defaultBoardType);
                console.log('[room] Usando board_type por defecto debido a error:', defaultBoardType);
            }
        } else {
            console.log('[room] ✅ Board type ya está en localStorage:', existingBoardType);
        }

        // Mostrar mensaje y redirigir
        console.log('[room] ✅ Todo listo, redirigiendo al juego...');
        this.showStatus('¡La partida ha comenzado! Redirigiendo...', 'success');
        
        // Redirigir después de un pequeño delay
        // Usar la función buildPageUrl para construir la URL de manera consistente
        setTimeout(() => {
            const juegoUrl = buildPageUrl(PAGES.juego, { game_id: gameId });
            console.log('[room] 🔗 Redirigiendo a:', juegoUrl);
            console.log('[room] 📦 localStorage final antes de redirigir:', {
                currentGameId: localStorage.getItem('currentGameId'),
                totalPlayers: localStorage.getItem('totalPlayers'),
                playerNames: localStorage.getItem('playerNames'),
                boardType: localStorage.getItem('boardType'),
                currentRoomCode: localStorage.getItem('currentRoomCode')
            });
            
            // Forzar la redirección
            window.location.href = juegoUrl;
        }, 800);
    }

    renderPlayersList(players) {
        const playersList = document.getElementById('playersList');
        const playerCountBadge = document.getElementById('playerCountBadge');
        const maxPlayers = parseInt(localStorage.getItem('maxPlayers') || '5');

        if (playersList) {
            playersList.innerHTML = '';
            players.forEach((player, index) => {
                const li = document.createElement('li');
                li.className = 'player-item';
                li.innerHTML = `
                    <div class="player-avatar">${player.username.charAt(0).toUpperCase()}</div>
                    <div class="player-name">${player.username}</div>
                    <div class="player-seat">Asiento ${index + 1}</div>
                `;
                playersList.appendChild(li);
            });
        }

        if (playerCountBadge) {
            playerCountBadge.textContent = `${players.length}/${maxPlayers}`;
        }
    }

    updateStartButton(playerCount) {
        const startBtn = document.getElementById('startGameBtn');
        if (!startBtn) return;

        const maxPlayers = parseInt(localStorage.getItem('maxPlayers') || '5');

        if (this.isAdmin && playerCount >= 2 && playerCount <= maxPlayers) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
    }

    leaveRoom() {
        if (confirm('¿Estás seguro de que deseas abandonar la sala?')) {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
            this.cleanupPreviousGame();
            window.location.href = PAGES.menu;
        }
    }

    copyRoomCode() {
        const roomCode = this.roomCode || document.getElementById('displayRoomCode')?.textContent || 
                        document.getElementById('roomCode')?.value;
        
        if (!roomCode) {
            this.showStatus('No hay código de sala para copiar', 'error');
            return;
        }

        // Intentar usar la API moderna del portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(roomCode).then(() => {
                this.showStatus('¡Código copiado al portapapeles!', 'success');
                
                // Cambiar temporalmente el ícono para feedback visual
                const copyBtn = document.getElementById('copyCodeBtn');
                if (copyBtn) {
                    const icon = copyBtn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-copy');
                        icon.classList.add('fa-check');
                        setTimeout(() => {
                            icon.classList.remove('fa-check');
                            icon.classList.add('fa-copy');
                        }, 2000);
                    }
                }
            }).catch(err => {
                console.error('Error al copiar:', err);
                this.fallbackCopyTextToClipboard(roomCode);
            });
        } else {
            // Fallback para navegadores que no soportan la API moderna
            this.fallbackCopyTextToClipboard(roomCode);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showStatus('¡Código copiado al portapapeles!', 'success');
            } else {
                this.showStatus('No se pudo copiar. Código: ' + text, 'error');
            }
        } catch (err) {
            console.error('Error al copiar:', err);
            this.showStatus('No se pudo copiar. Código: ' + text, 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    addTestPlayersButton() {
        // Mostrar botón de testing solo si es admin
        const testBtn = document.getElementById('addTestingPlayersBtn');
        
        if (!testBtn) {
            // Si no existe el botón en el HTML, no hacer nada
            return;
        }

        if (!this.isAdmin) {
            // Ocultar el botón si no es admin
            testBtn.style.display = 'none';
            return;
        }

        // Mostrar el botón si es admin y la sala está creada
        // Solo mostrar cuando la sala está activa (no en el formulario de creación)
        const configForm = document.getElementById('config-form');
        if (configForm && configForm.style.display !== 'none') {
            // Si el formulario de creación está visible, ocultar el botón
            testBtn.style.display = 'none';
        } else {
            // Si la sala está creada, mostrar el botón en la sección de acciones
            const actionButtons = document.querySelector('.action-buttons');
            if (actionButtons) {
                // Mover el botón a la sección de acciones si no está ahí
                if (!actionButtons.contains(testBtn)) {
                    const startBtn = document.getElementById('startGameBtn');
                    if (startBtn) {
                        actionButtons.insertBefore(testBtn, startBtn);
                    } else {
                        actionButtons.appendChild(testBtn);
                    }
                }
                testBtn.style.display = 'block';
            }
        }
        
        // Asegurarse de que tiene el listener
        if (!testBtn.hasAttribute('data-listener-attached')) {
            testBtn.setAttribute('data-listener-attached', 'true');
            testBtn.addEventListener('click', () => this.addTestPlayers());
        }
    }

    async addTestPlayers() {
        // Verificar que es admin antes de permitir agregar jugadores
        if (!this.isAdmin) {
            this.showStatus('Solo el administrador puede agregar jugadores de prueba', 'error');
            return;
        }

        try {
            this.showLoading('Agregando jugadores de prueba...');
            
            const userId = obtenerIdUsuario();
            const response = await fetch(`${getApiBase()}/api/room/${this.roomCode}/add-test-players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[room] Respuesta no JSON:', text);
                throw new Error('El servidor respondió con un formato inesperado');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al agregar jugadores');
            }

            console.log('[room] Jugadores agregados:', data.message);
            
            // Actualizar lista de jugadores
            await this.updatePlayersList();
            
            // Verificar si se pueden agregar más jugadores
            if (data.added && data.added > 0) {
                this.showStatus(`${data.message}`, 'success');
            } else {
                this.showStatus('No se pudieron agregar más jugadores. La sala puede estar llena.', 'info');
            }

        } catch (err) {
            console.error('[room] Error al agregar jugadores:', err);
            this.showStatus(err.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const waitingRoom = new WaitingRoom();
    // Llamar init() aquí porque es async y necesitamos esperar a que el DOM esté listo
    await waitingRoom.init();
    
    // Timeout handler para loading overlay
    let loadingStartTime = null;
    
    const checkLoadingTimeout = setInterval(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && overlay.style.display !== 'none') {
            if (!loadingStartTime) {
                loadingStartTime = Date.now();
            }
            
            // Aumentado a 120 segundos para dar más tiempo a la creación del juego
            if (Date.now() - loadingStartTime > 120000) {
                console.error('[room] Timeout: El proceso está tomando demasiado tiempo');
                overlay.style.display = 'none';
                loadingStartTime = null;
                
                const alert = document.getElementById('statusAlert');
                const text = document.getElementById('statusText');
                if (alert && text) {
                    text.textContent = 'Error: El proceso está tardando demasiado. Revisa la consola del servidor.';
                    alert.className = 'status-alert error';
                    alert.style.display = 'flex';
                }
            }
        } else {
            loadingStartTime = null;
        }
    }, 1000);
});

export default WaitingRoom;