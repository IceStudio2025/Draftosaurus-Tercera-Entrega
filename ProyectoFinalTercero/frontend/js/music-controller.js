class MusicController {
    constructor() {
        this.audio = null;
        this.storageKey = 'draftosaurus_music_state';
        this.controlsCreated = false;
        this.shouldPlay = false;
        this.autoPlayAttempted = false;
        this.interactionListenersSetup = false;
        this.visibilityListenersSetup = false;
        
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'homepage.html' || currentPage === 'tiendahomepage.html') {
            return;
        }
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('🎵 Setup iniciado');
        
        this.audio = document.getElementById('musicaFondo');
        
        if (!this.audio) {
            console.log('🎵 Creando nuevo elemento de audio');
            this.audio = new Audio();
            this.audio.id = 'musicaFondo';
            this.audio.loop = true;
            this.audio.style.display = 'none';
            
            const possiblePaths = [
                './musica/soundtrack.mp3',
                '../musica/soundtrack.mp3',
                '/musica/soundtrack.mp3',
                'musica/soundtrack.mp3'
            ];
            
            this.audio.src = possiblePaths[0];
            console.log('🎵 Intentando cargar música desde:', possiblePaths[0]);
            
            document.body.appendChild(this.audio);
        } else {
            console.log('🎵 Elemento de audio encontrado');
            this.audio.removeAttribute('controls');
            this.audio.style.display = 'none';
        }

        this.audio.addEventListener('loadeddata', () => {
            console.log('✅ Música cargada correctamente');
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('❌ Error cargando música:', e);
            console.error('Ruta intentada:', this.audio.src);
        });

        this.audio.addEventListener('pause', () => {
            this.saveState();
        });

        this.loadState();

        setTimeout(() => this.createControls(), 100);

        window.addEventListener('beforeunload', () => this.saveState());
        window.addEventListener('pagehide', () => this.saveState());
        
        setInterval(() => {
            if (this.audio && !this.audio.paused) {
                this.saveState();
            }
        }, 2000);
        
        if (!this.visibilityListenersSetup) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.shouldPlay && !this.audio.muted && this.audio && this.audio.paused) {
                    setTimeout(() => {
                        if (this.audio && !this.audio.muted && this.audio.paused) {
                            this.audio.play().then(() => {
                                console.log('✅ Música reproduciéndose después de volver a la página');
                                this.saveState();
                            }).catch(() => {});
                        }
                    }, 100);
                }
            });
            
            window.addEventListener('focus', () => {
                if (this.shouldPlay && !this.audio.muted && this.audio && this.audio.paused) {
                    setTimeout(() => {
                        if (this.audio && !this.audio.muted && this.audio.paused) {
                            this.audio.play().then(() => {
                                console.log('✅ Música reproduciéndose después de recibir foco');
                                this.saveState();
                            }).catch(() => {});
                        }
                    }, 100);
                }
            });
            
            this.visibilityListenersSetup = true;
            console.log('✅ Listeners de visibilidad y foco configurados');
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem(this.storageKey);
            if (savedState) {
                const state = JSON.parse(savedState);
                this.audio.volume = state.volume || 0.5;
                this.audio.muted = state.muted || false;
                
                this.shouldPlay = state.isPlaying && !state.muted;
                
                if (state.currentTime && state.currentTime > 0) {
                    this.audio.currentTime = state.currentTime;
                    console.log('🎵 Tiempo restaurado:', state.currentTime);
                }
                
                console.log('🎵 Estado cargado:', state);
                console.log('🎵 Debería reproducirse:', this.shouldPlay);
            } else {
                this.audio.volume = 0.5;
                this.shouldPlay = true;
                console.log('🎵 Estado inicial: volumen 50%, debería reproducirse: true');
            }
            
            const tryPlay = (force = false) => {
                if (!force && (this.audio.muted || (!this.audio.paused && this.audio.currentTime > 0))) {
                    if (this.audio.muted) {
                        console.log('🎵 Música silenciada, no se reproduce automáticamente');
                    }
                    return;
                }
                
                if (!force && !this.shouldPlay && !this.audio.muted) {
                    return;
                }
                
                if (this.audio.readyState >= 2) {
                    this.audio.play().then(() => {
                        console.log('✅ Música reproduciéndose automáticamente');
                        this.saveState();
                        this.autoPlayAttempted = false;
                    }).catch(err => {
                        console.log('⚠️ Autoplay bloqueado, esperando interacción del usuario:', err.message);
                        this.autoPlayAttempted = true;
                    });
                } else {
                    this.audio.addEventListener('canplay', () => tryPlay(force), { once: true });
                }
            };
            
            if (this.audio.readyState >= 2) {
                tryPlay();
            } else {
                this.audio.addEventListener('canplay', () => tryPlay(), { once: true });
                setTimeout(() => tryPlay(), 500);
            }
            
            if (!this.interactionListenersSetup) {
                const playOnInteraction = () => {
                    if (this.shouldPlay && !this.audio.muted && this.audio.paused) {
                        this.audio.play().then(() => {
                            console.log('✅ Música reproduciéndose después de interacción');
                            this.saveState();
                            this.autoPlayAttempted = false;
                        }).catch(() => {});
                    }
                };
                
                document.addEventListener('click', playOnInteraction);
                document.addEventListener('touchstart', playOnInteraction);
                document.addEventListener('keydown', playOnInteraction);
                const playOnMouseMove = () => {
                    playOnInteraction();
                };
                document.addEventListener('mousemove', playOnMouseMove, { once: true });
                
                this.interactionListenersSetup = true;
                console.log('✅ Listeners de interacción configurados');
            }
        } catch (error) {
            console.error('❌ Error cargando estado de música:', error);
            this.audio.volume = 0.5;
        }
    }

    saveState() {
        try {
            if (!this.audio) return;
            const state = {
                volume: this.audio.volume,
                muted: this.audio.muted,
                currentTime: this.audio.currentTime,
                isPlaying: !this.audio.paused || this.shouldPlay
            };
            this.shouldPlay = state.isPlaying && !state.muted;
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.error('❌ Error guardando estado:', error);
        }
    }

    createControls() {
        if (this.controlsCreated || document.querySelector('.music-controls')) {
            console.log('ℹ️ Controles ya existen');
            return;
        }

        let navLinks = document.querySelector('.nav-links');
        if (!navLinks) {
            const navbar = document.querySelector('.navbar-custom');
            if (navbar) {
                navLinks = document.createElement('div');
                navLinks.className = 'nav-links';
                navbar.appendChild(navLinks);
            } else {
                console.log('ℹ️ No se encontró navbar para insertar controles de música');
                return;
            }
        }

        console.log('✅ nav-links encontrado, creando controles');

        const musicControls = document.createElement('div');
        musicControls.className = 'music-controls';
        musicControls.innerHTML = `
            <button class="music-btn" id="music-mute" title="Silenciar">
                <i class="fas fa-volume-up"></i>
            </button>
            <div class="volume-container">
                <input type="range" id="music-volume" min="0" max="100" value="50" class="volume-slider">
                <span class="volume-text" id="volume-text">50%</span>
            </div>
        `;

        navLinks.insertBefore(musicControls, navLinks.firstChild);
        this.controlsCreated = true;
        console.log('✅ Controles insertados en el navbar');

        this.setupControlListeners();
        this.updateUI();
    }

    setupControlListeners() {
        const muteBtn = document.getElementById('music-mute');
        const volumeSlider = document.getElementById('music-volume');

        if (!muteBtn || !volumeSlider) {
            console.error('❌ No se encontraron los controles');
            return;
        }

        console.log('✅ Configurando listeners');

        muteBtn.addEventListener('click', () => {
            this.audio.muted = !this.audio.muted;
            console.log('🔇 Mute:', this.audio.muted);
            
            if (!this.audio.muted) {
                this.shouldPlay = true;
                if (this.audio.paused) {
                    this.audio.play().then(() => {
                        console.log('✅ Música reproduciéndose después de desactivar mute');
                        this.saveState();
                    }).catch(err => {
                        console.log('⚠️ Error al reproducir:', err.message);
                        this.autoPlayAttempted = true;
                    });
                }
            } else {
                this.audio.pause();
            }
            
            this.updateUI();
            this.saveState();
        });

        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audio.volume = volume;
            const volumeText = document.getElementById('volume-text');
            if (volumeText) {
                volumeText.textContent = e.target.value + '%';
            }
            
            if (volume > 0 && this.audio.muted) {
                this.audio.muted = false;
            }
            
            this.updateUI();
        });

        volumeSlider.addEventListener('change', () => {
            this.saveState();
        });
    }

    updateUI() {
        const muteBtn = document.getElementById('music-mute');
        const volumeSlider = document.getElementById('music-volume');
        const volumeText = document.getElementById('volume-text');

        if (!muteBtn || !volumeSlider || !this.audio) return;

        const muteIcon = muteBtn.querySelector('i');
        if (muteIcon) {
            if (this.audio.muted || this.audio.volume === 0) {
                muteIcon.className = 'fas fa-volume-mute';
                muteBtn.title = 'Activar sonido';
            } else if (this.audio.volume < 0.5) {
                muteIcon.className = 'fas fa-volume-down';
                muteBtn.title = 'Silenciar';
            } else {
                muteIcon.className = 'fas fa-volume-up';
                muteBtn.title = 'Silenciar';
            }
        }

        const volumeValue = Math.round(this.audio.volume * 100);
        volumeSlider.value = volumeValue;
        if (volumeText) {
            volumeText.textContent = volumeValue + '%';
        }

        const percentage = volumeValue;
        volumeSlider.style.background = `linear-gradient(to right, #ff8c00 0%, #ff8c00 ${percentage}%, #ddd ${percentage}%, #ddd 100%)`;
    }
}

const currentPage = window.location.pathname.split('/').pop();
if (currentPage !== 'homepage.html' && currentPage !== 'tiendahomepage.html') {
    window.musicController = new MusicController();
}

