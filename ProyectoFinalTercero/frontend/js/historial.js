function showNotification(message, type = 'info') {
    try {
        const el = document.getElementById('mensaje-sistema');
        if (!el) { console[type === 'error' ? 'error' : 'log'](message); return; }
        el.textContent = message;
        el.className = `mensaje-sistema ${type}`;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
    } catch (_) {
        console.log(message);
    }
}
import { obtenerIdUsuario, obtenerNombreUsuario, cerrarSesion, PAGES, buildPageUrl } from './auth.js';

class HistorialManager {
    constructor() {
        this.games = [];
        this.filteredGames = [];
        this.currentPage = 1;
        this.gamesPerPage = 10;
        this.currentView = 'lista';
        this.filters = {
            fecha: 'todas',
            resultado: 'todos',
            jugadores: 'todos'
        };
        
        this.init();
    }

    async init() {
        if (!this.verificarAutenticacion()) {
            return;
        }
        
        this.setupEventListeners();
        this.mostrarNombreUsuario();
        await this.loadGames();
        this.updateStats();
        this.renderGames();
        
        setTimeout(() => {
            if (window.AutoTranslator && window.GameSettings) {
                const settings = window.GameSettings.get();
                if (settings.language && settings.language !== 'es') {
                    window.AutoTranslator.translatePage(settings.language);
                }
            }
        }, 100);
    }

    verificarAutenticacion() {
        const userId = this.getUserId();
        if (!userId) {
            console.error('Usuario no autenticado');
            showNotification('Debes iniciar sesión para ver el historial', 'error');
            setTimeout(() => {
                window.location.href = PAGES.login;
            }, 2000);
            return false;
        }
        return true;
    }

    mostrarNombreUsuario() {
        const nombreUsuarioElement = document.getElementById('nombre-usuario');
        if (!nombreUsuarioElement) return;
        const username = obtenerNombreUsuario();
        
        // Verificar si ya tiene un span, si no, crear la estructura
        let span = nombreUsuarioElement.querySelector('span');
        if (!span) {
            nombreUsuarioElement.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username || "Jugador"}</span>`;
        } else {
            span.textContent = username || "Jugador";
        }
    }

    setupEventListeners() {
        document.getElementById('filtro-fecha').addEventListener('change', (e) => {
            this.filters.fecha = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filtro-resultado').addEventListener('change', (e) => {
            this.filters.resultado = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filtro-jugadores').addEventListener('change', (e) => {
            this.filters.jugadores = e.target.value;
            this.applyFilters();
        });

        document.getElementById('btn-vista-lista').addEventListener('click', () => {
            this.setView('lista');
        });

        document.getElementById('btn-vista-grid').addEventListener('click', () => {
            this.setView('grid');
        });

        document.getElementById('btn-prev').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            this.nextPage();
        });

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                cerrarSesion();
                window.location.href = PAGES.login;
            });
        }
    }

    async loadGames() {
        try {
            this.showLoading(true);
            
            const userId = this.getUserId();
            if (!userId) {
                throw new Error('Usuario no autenticado');
            }
            
            console.log('Cargando historial para usuario:', userId);
            const apiBase = this.getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/game/history/${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            console.log('Respuesta del servidor:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error del servidor:', errorText);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Datos del historial recibidos:', data);
            
            if (data && data.success && Array.isArray(data.games)) {
                this.games = data.games.map(game => this.mapGameData(game));
                this.filteredGames = [...this.games];
                console.log(`Se cargaron ${this.games.length} partidas`);
            } else {
                console.log('No se encontraron partidas o error en la respuesta');
                this.games = [];
                this.filteredGames = [];
            }
            
            this.showLoading(false);
            this.showEmptyState(this.filteredGames.length === 0);
            this.renderGames();
            this.updateStats();
            
        } catch (error) {
            console.error('Error cargando historial:', error);
            showNotification('Error al cargar el historial de partidas: ' + error.message, 'error');
            this.showLoading(false);
            this.showEmptyState(true);
        }
    }

    // Detectar URL base de la API de forma robusta
    getApiBaseUrl() {
        // Usar el sistema centralizado de configuración de API
        if (window.getApiBase) {
            return window.getApiBase();
        }
        
        // Fallback al método anterior si no está disponible
        const saved = localStorage.getItem('API_BASE_URL');
        if (saved) return saved.replace(/\/$/, '');

        const origin = window.location.origin;
        if (origin.startsWith('file://') || origin.includes(':5500')) {
            return 'http://localhost:8000';
        }

        return origin;
    }

    getUserId() {
        return obtenerIdUsuario();
    }

    getUsername() {
        return obtenerNombreUsuario();
    }

    mapGameData(game) {
        const currentUserId = this.getUserId();
        
        let isWinner = false;
        let myPoints = 0;
        let winnerPoints = 0;
        
        if (game.winner_info) {
            isWinner = game.winner_info.user_id == currentUserId;
            winnerPoints = game.winner_info.total_points || 0;
        }
        
        if (game.my_score) {
            myPoints = game.my_score.total_points || 0;
        }
        
        if (!isWinner && myPoints > 0 && winnerPoints > 0 && myPoints === winnerPoints) {
            isWinner = true;
        }
        
        // Calcular número total de jugadores de forma más precisa
        // Usar all_scores si está disponible (más confiable), sino usar opponents
        let playerCount = 2; // Valor por defecto
        if (game.all_scores && Array.isArray(game.all_scores) && game.all_scores.length > 0) {
            // all_scores tiene una entrada por cada jugador
            playerCount = game.all_scores.length;
            console.log(`Game #${game.game_id}: playerCount calculado desde all_scores: ${playerCount}`);
        } else if (game.opponents && Array.isArray(game.opponents) && game.opponents.length > 0) {
            // Según GameRepository::getGameHistory, opponents incluye TODOS los jugadores
            // Entonces opponents.length es el número total de jugadores
            playerCount = game.opponents.length;
            console.log(`Game #${game.game_id}: playerCount calculado desde opponents: ${playerCount} (opponents.length=${game.opponents.length})`);
        } else {
            console.log(`Game #${game.game_id}: playerCount usando valor por defecto: ${playerCount}`);
        }
        
        return {
            game_id: game.game_id,
            date: game.created_at || game.finished_at,
            created_at: game.created_at,
            finished_at: game.finished_at,
            duration_minutes: game.duration_minutes || 0,
            status: isWinner ? 'victoria' : 'derrota',
            room_code: game.room_code || null,
            opponents: game.opponents || [],
            winner_info: game.winner_info || null,
            my_score: game.my_score || null,
            all_scores: game.all_scores || [],
            player_seat: game.player_seat || 0,
            playerCount: playerCount
        };
    }


    applyFilters() {
        console.log('Aplicando filtros:', this.filters);
        console.log('Total de partidas antes de filtrar:', this.games.length);
        
        this.filteredGames = this.games.filter(game => {
            if (this.filters.fecha !== 'todas') {
                const now = new Date();
                const gameDate = new Date(game.date);
                
                switch (this.filters.fecha) {
                    case 'hoy':
                        if (!this.isSameDay(gameDate, now)) return false;
                        break;
                    case 'semana':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (gameDate < weekAgo) return false;
                        break;
                    case 'mes':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (gameDate < monthAgo) return false;
                        break;
                }
            }
            
            if (this.filters.resultado !== 'todos') {
                if (game.status !== this.filters.resultado) return false;
            }
            
            if (this.filters.jugadores !== 'todos') {
                const filterPlayerCount = parseInt(this.filters.jugadores, 10);
                const gamePlayerCount = parseInt(game.playerCount, 10);
                
                console.log(`Partida #${game.game_id}: playerCount=${gamePlayerCount}, filter=${filterPlayerCount}, all_scores.length=${game.all_scores?.length || 0}, opponents.length=${game.opponents?.length || 0}`);
                
                // Comparar números de jugadores
                if (gamePlayerCount !== filterPlayerCount) {
                    return false;
                }
            }
            
            return true;
        });
        
        console.log('Partidas después de filtrar:', this.filteredGames.length);
        
        this.currentPage = 1;
        this.showEmptyState(this.filteredGames.length === 0);
        this.renderGames();
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    setView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-vista-${view}`).classList.add('active');
        
        const container = document.getElementById('games-container');
        container.className = `games-container ${view === 'grid' ? 'grid-view' : ''}`;
        
        this.renderGames();
    }

    renderGames() {
        const container = document.getElementById('games-container');
        const startIndex = (this.currentPage - 1) * this.gamesPerPage;
        const endIndex = startIndex + this.gamesPerPage;
        const gamesToShow = this.filteredGames.slice(startIndex, endIndex);
        
        container.innerHTML = gamesToShow.map(game => this.createGameCard(game)).join('');
        
        try { this.translateDynamicContent(); } catch (e) { console.warn('translateDynamicContent error:', e); }
        
        this.updatePagination();
    }

    translateDynamicContent() {
        try {
            if (window.AutoTranslator && window.GameSettings) {
                const settings = window.GameSettings.get();
                if (settings.language && settings.language !== 'es') {
                    const container = document.getElementById('games-container');
                    if (container) {
                        const dict = window.AutoTranslator.dictionary[settings.language];
                        if (dict && typeof window.AutoTranslator.translateNode === 'function') {
                            window.AutoTranslator.translateNode(container, dict);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('AutoTranslator failed:', e);
        }
    }

    createGameCard(game) {
        // Usar date o created_at según esté disponible
        const gameDate = game.date || game.created_at || game.finished_at;
        const dateStr = this.formatDate(new Date(gameDate));
        const durationStr = this.formatDuration(game.duration_minutes || 0);
        
        // Usar el status ya calculado en mapGameData
        const isWinner = game.status === 'victoria';
        const winnerName = game.winner_info ? game.winner_info.username : 'Sin datos';
        const winnerPoints = game.winner_info && typeof game.winner_info.total_points !== 'undefined'
            ? game.winner_info.total_points
            : 0;
        
        // Obtener MI puntaje
        const myPoints = game.my_score && typeof game.my_score.total_points !== 'undefined'
            ? game.my_score.total_points
            : 0;
        
        // Formatear lista de oponentes (excluir al usuario actual)
        const currentUserId = this.getUserId();
        const opponentsFiltered = game.opponents ? game.opponents.filter(p => p.id != currentUserId) : [];
        const opponents = this.formatOpponents(game);
        
        // Información de la sala
        const roomInfo = game.room_code ? `Sala: ${game.room_code}` : 'Sin sala';
        
        // Crear tabla de puntajes si hay información
        let scoresTable = '';
        if (game.all_scores && game.all_scores.length > 0) {
            scoresTable = '<div class="scores-table">';
            game.all_scores.forEach((score, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                const isMe = score.user_id == currentUserId;
                scoresTable += `
                    <div class="score-row ${isMe ? 'my-score' : ''}">
                        <span class="medal">${medal}</span>
                        <span class="player-name">${score.username || 'Jugador ' + (score.player_seat + 1)}</span>
                        <span class="player-points">${score.total_points || 0} pts</span>
                    </div>
                `;
            });
            scoresTable += '</div>';
        }
        
        return `
            <div class="game-card ${isWinner ? 'winner-card' : 'loser-card'}">
                <div class="game-header">
                    <span class="game-date">${dateStr}</span>
                    <span class="game-status ${isWinner ? 'victoria' : 'derrota'}">
                        <i class="fas fa-${isWinner ? 'trophy' : 'times-circle'}"></i>
                        ${isWinner ? 'Victoria' : 'Derrota'}
                    </span>
                </div>
                
                <div class="game-info">
                    <h3 class="game-title">Partida #${game.game_id}</h3>
                    <div class="game-details">
                        <div class="game-detail">
                            <i class="fas fa-users"></i>
                            <span>${game.playerCount} jugadores</span>
                        </div>
                        <div class="game-detail">
                            <i class="fas fa-clock"></i>
                            <span>${durationStr}</span>
                        </div>
                        <div class="game-detail">
                            <i class="fas fa-user-friends"></i>
                            <span>vs ${opponents}</span>
                        </div>
                        <div class="game-detail">
                            <i class="fas fa-door-open"></i>
                            <span>${roomInfo}</span>
                        </div>
                    </div>
                    
                    <div class="game-scores-summary">
                        <div class="my-score-display">
                            <i class="fas fa-star"></i>
                            <strong>Tu puntaje:</strong> ${myPoints} pts
                        </div>
                        ${scoresTable}
                    </div>
                </div>
                
                <div class="game-winner-section">
                    <div class="winner-badge">
                        <i class="fas fa-crown"></i>
                    </div>
                    <div class="winner-info">
                        <div class="winner-name">${winnerName}</div>
                        <div class="winner-points">${winnerPoints} puntos</div>
                    </div>
                </div>
            </div>
        `;
    }

    formatOpponents(game) {
        if (!game.opponents) return 'Sin oponentes';
        
        const currentUserId = this.getUserId();
        const opponentNames = game.opponents
            .filter(player => player.id != currentUserId)
            .map(player => player.username);
        
        if (opponentNames.length === 0) return 'Sin oponentes';
        if (opponentNames.length === 1) return opponentNames[0];
        if (opponentNames.length === 2) return `${opponentNames[0]} y ${opponentNames[1]}`;
        return `${opponentNames[0]}, ${opponentNames[1]}, +${opponentNames.length - 2} más`;
    }

    formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Hoy';
        if (diffDays === 2) return 'Ayer';
        if (diffDays <= 7) return `Hace ${diffDays - 1} días`;
        
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatDuration(minutes) {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}min`;
    }

    getStatusText(status) {
        const statusMap = {
            'victoria': 'Victoria',
            'derrota': 'Derrota',
            'mi-turno': 'Tu Turno',
            'turno-oponente': 'Turno Oponente',
            'en-progreso': 'En Progreso',
            'desconocido': 'Desconocido'
        };
        return statusMap[status] || status;
    }

    updateStats() {
        const totalGames = this.games.length;
        const currentUserId = this.getUserId();
        
        // Contar victorias usando el status ya calculado
        const victories = this.games.filter(g => {
            return g.status === 'victoria';
        }).length;
        
        // Calcular duración promedio en minutos
        const averageDuration = this.games.length > 0 
            ? Math.round(this.games.reduce((sum, g) => sum + (g.duration_minutes || 0), 0) / this.games.length)
            : 0;
        
        document.getElementById('total-partidas').textContent = totalGames;
        document.getElementById('victorias').textContent = victories;
        
        // Formatear duración promedio
        const avgDurationStr = averageDuration < 60 
            ? `${averageDuration} min` 
            : `${Math.floor(averageDuration / 60)}h ${averageDuration % 60}min`;
        
        document.getElementById('promedio-puntos').textContent = avgDurationStr;
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredGames.length / this.gamesPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        document.getElementById('btn-prev').disabled = this.currentPage === 1;
        document.getElementById('btn-next').disabled = this.currentPage === totalPages;
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
            // Traducir texto de paginación después de actualizar
            this.translateDynamicContent();
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderGames();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredGames.length / this.gamesPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderGames();
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading-state');
        const container = document.getElementById('games-container');
        
        if (show) {
            loading.style.display = 'block';
            container.style.display = 'none';
        } else {
            loading.style.display = 'none';
            container.style.display = 'block';
        }
    }

    showEmptyState(show) {
        const empty = document.getElementById('empty-state');
        const container = document.getElementById('games-container');
        
        if (show) {
            empty.style.display = 'block';
            container.style.display = 'none';
        } else {
            empty.style.display = 'none';
            container.style.display = 'block';
        }
    }

    /**
     * Traduce un texto usando el traductor automático
     */
    translateText(text) {
        if (window.AutoTranslator && window.GameSettings) {
            const settings = window.GameSettings.get();
            if (settings.language && settings.language !== 'es') {
                const dict = window.AutoTranslator.dictionary[settings.language];
                if (dict && dict[text]) {
                    return dict[text];
                }
            }
        }
        return text;
    }

    // Métodos de acción
    replayGame(gameId) {
        const game = this.games.find(g => g.game_id === gameId);
        if (game) {
            const message = this.translateText(`Iniciando partida similar a la #${gameId}...`);
            showNotification(message, 'success');
            setTimeout(() => {
                window.location.href = './waiting-room.html';
            }, 1500);
        }
    }

    continueGame(gameId) {
        const game = this.games.find(g => g.game_id === gameId);
        if (game) {
            const message = this.translateText(`Continuando partida #${gameId}...`);
            showNotification(message, 'success');
            // Guardar el ID del juego en localStorage para que el juego lo reconozca
            localStorage.setItem('currentGameId', gameId);
            // Redirigir al juego
            setTimeout(() => {
                window.location.href = buildPageUrl(PAGES.juego, { game_id: gameId });
            }, 1000);
        }
    }

    viewGameDetails(gameId) {
        const game = this.games.find(g => g.game_id === gameId);
        if (game) {
            const message = this.translateText(`Mostrando detalles de la partida #${gameId}...`);
            showNotification(message, 'info');
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.historialManager = new HistorialManager();
});

// Exportar para uso global
export default HistorialManager;
