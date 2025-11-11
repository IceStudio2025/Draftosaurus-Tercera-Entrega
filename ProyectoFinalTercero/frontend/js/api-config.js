/**
 * Sistema de configuración de API para soporte LAN
 * Detecta automáticamente la IP local y permite configuración manual
 */

class ApiConfig {
    constructor() {
        this.defaultPort = 8000;
        this.detectedIP = null;
        this.init();
    }

    async init() {
        // Cargar configuración guardada
        const saved = localStorage.getItem('API_BASE_URL');
        
        if (saved) {
            console.log('[API Config] Usando URL guardada:', saved);
            return;
        }

        // Intentar detectar IP local automáticamente
        await this.detectLocalIP();
    }

    /**
     * Detecta la IP local del dispositivo
     */
    async detectLocalIP() {
        try {
            // Método 1: Usar WebRTC para detectar IP local
            const ip = await this.getLocalIPViaWebRTC();
            if (ip) {
                this.detectedIP = ip;
                console.log('[API Config] IP local detectada:', ip);
                return ip;
            }
        } catch (error) {
            console.warn('[API Config] No se pudo detectar IP vía WebRTC:', error);
        }

        // Método 2: Intentar con localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.detectedIP = 'localhost';
            return 'localhost';
        }

        // Método 3: Usar el hostname actual si estamos en una IP
        const hostname = window.location.hostname;
        if (this.isValidIP(hostname) && !hostname.startsWith('127.')) {
            this.detectedIP = hostname;
            return hostname;
        }

        return null;
    }

    /**
     * Detecta IP local usando WebRTC
     */
    getLocalIPViaWebRTC() {
        return new Promise((resolve, reject) => {
            const RTCPeerConnection = window.RTCPeerConnection || 
                                     window.mozRTCPeerConnection || 
                                     window.webkitRTCPeerConnection;

            if (!RTCPeerConnection) {
                reject(new Error('WebRTC no disponible'));
                return;
            }

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.createDataChannel('');
            
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const candidate = event.candidate.candidate;
                    const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
                    if (match) {
                        const ip = match[1];
                        // Filtrar IPs privadas
                        if (this.isPrivateIP(ip)) {
                            pc.close();
                            resolve(ip);
                        }
                    }
                }
            };

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(reject);

            // Timeout después de 3 segundos
            setTimeout(() => {
                pc.close();
                reject(new Error('Timeout detectando IP'));
            }, 3000);
        });
    }

    /**
     * Verifica si una IP es privada (LAN)
     */
    isPrivateIP(ip) {
        const parts = ip.split('.').map(Number);
        return (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            parts[0] === 127
        );
    }

    /**
     * Valida si un string es una IP válida
     */
    isValidIP(str) {
        const parts = str.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    /**
     * Obtiene la URL base de la API
     */
    getApiBase() {
        // 1. Verificar si hay una URL guardada manualmente
        const saved = localStorage.getItem('API_BASE_URL');
        if (saved) {
            return saved.replace(/\/$/, ''); // Remover trailing slash
        }

        // 2. Si estamos en localhost, usar localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://localhost:${this.defaultPort}`;
        }

        // 3. Si detectamos una IP local, usarla
        if (this.detectedIP && this.detectedIP !== 'localhost') {
            return `http://${this.detectedIP}:${this.defaultPort}`;
        }

        // 4. Usar el hostname actual
        const hostname = window.location.hostname;
        if (this.isValidIP(hostname) || hostname.includes('.')) {
            return `http://${hostname}:${this.defaultPort}`;
        }

        // 5. Fallback a localhost
        return `http://localhost:${this.defaultPort}`;
    }

    /**
     * Establece manualmente la URL base de la API
     */
    setApiBase(url) {
        // Validar formato básico
        if (!url || typeof url !== 'string') {
            throw new Error('URL inválida');
        }

        // Normalizar URL
        let normalized = url.trim();
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `http://${normalized}`;
        }
        normalized = normalized.replace(/\/$/, ''); // Remover trailing slash

        // Guardar en localStorage
        localStorage.setItem('API_BASE_URL', normalized);
        console.log('[API Config] URL de API configurada manualmente:', normalized);
        
        return normalized;
    }

    /**
     * Resetea la configuración a la detección automática
     */
    reset() {
        localStorage.removeItem('API_BASE_URL');
        this.detectedIP = null;
        return this.getApiBase();
    }

    /**
     * Obtiene información de la configuración actual
     */
    getInfo() {
        const saved = localStorage.getItem('API_BASE_URL');
        return {
            current: this.getApiBase(),
            isManual: !!saved,
            detectedIP: this.detectedIP,
            hostname: window.location.hostname
        };
    }

    /**
     * Prueba la conexión con el servidor
     */
    async testConnection(url = null) {
        const testUrl = url || this.getApiBase();
        try {
            const response = await fetch(`${testUrl}/api/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
            });
            return response.ok;
        } catch (error) {
            console.error('[API Config] Error probando conexión:', error);
            return false;
        }
    }
}

// Crear instancia global
window.ApiConfig = new ApiConfig();

// Exportar para módulos ES6
export default window.ApiConfig;

// Función helper global para obtener API_BASE
window.getApiBase = function() {
    return window.ApiConfig.getApiBase();
};


