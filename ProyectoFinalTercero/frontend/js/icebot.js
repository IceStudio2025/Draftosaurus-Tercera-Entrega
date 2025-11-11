class IceBot {
    constructor() {
        this.chatContainer = null;
        this.messagesContainer = null;
        this.input = null;
        this.sendButton = null;
        this.isOpen = false;
        this.welcomeShown = false;
        this.messages = [];
        this.storageKey = 'icebot_messages';
        this.init();
    }

    init() {
        this.createChatHTML();
        this.setupEventListeners();
        this.loadMessages();
        
        setTimeout(() => {
            if (this.messages.length === 0 && !this.welcomeShown) {
                this.showWelcomeMessage();
                this.welcomeShown = true;
            }
        }, 500);
    }

    createChatHTML() {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'icebot-toggle';
        toggleButton.id = 'icebot-toggle';
        toggleButton.setAttribute('aria-label', 'Abrir chat de IceBot');
        toggleButton.innerHTML = '<img src="./img/icestudio.png" alt="IceBot">';
        document.body.appendChild(toggleButton);

        const chatContainer = document.createElement('div');
        chatContainer.className = 'icebot-chat-container';
        chatContainer.id = 'icebot-chat';
        chatContainer.innerHTML = `
            <div class="icebot-header">
                <div class="icebot-header-info">
                    <img src="./img/icestudio.png" alt="IceBot" class="icebot-avatar">
                    <div class="icebot-header-text">
                        <h3>IceBot</h3>
                        <p>En línea</p>
                    </div>
                </div>
                <button class="icebot-close" id="icebot-close" aria-label="Cerrar chat">×</button>
            </div>
            <div class="icebot-messages" id="icebot-messages"></div>
            <div class="icebot-footer">
                <button id="icebot-stats" title="Ver estadísticas">
                    <i class="fas fa-chart-bar"></i> Estadísticas
                </button>
                <button id="icebot-clear" title="Limpiar historial">
                    <i class="fas fa-trash-alt"></i> Limpiar
                </button>
            </div>
            <div class="icebot-input-container">
                <input 
                    type="text" 
                    class="icebot-input" 
                    id="icebot-input" 
                    placeholder="Escribe tu mensaje..."
                    maxlength="500"
                >
                <button class="icebot-send" id="icebot-send" aria-label="Enviar mensaje">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(chatContainer);

        this.chatContainer = chatContainer;
        this.messagesContainer = document.getElementById('icebot-messages');
        this.input = document.getElementById('icebot-input');
        this.sendButton = document.getElementById('icebot-send');
    }

    setupEventListeners() {
        document.getElementById('icebot-toggle').addEventListener('click', () => {
            this.toggleChat();
        });

        document.getElementById('icebot-close').addEventListener('click', () => {
            this.closeChat();
        });

        const clearButton = document.getElementById('icebot-clear');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que quieres limpiar todo el historial de conversación?')) {
                    this.clearMessages();
                }
            });
        }

        const statsButton = document.getElementById('icebot-stats');
        if (statsButton) {
            statsButton.addEventListener('click', () => {
                const commandResponse = this.handleSpecialCommands('/estadisticas');
                if (commandResponse) {
                    this.addMessage('bot', commandResponse);
                }
            });
        }

        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.chatContainer.classList.add('active');
        this.isOpen = true;
        this.input.focus();
        this.scrollToBottom();
    }

    closeChat() {
        this.chatContainer.classList.remove('active');
        this.isOpen = false;
    }

    showWelcomeMessage() {
        const welcomeText = "¡Hola! Soy IceBot, guardián del parque jurásico. Pregúntame reglas, estrategias o jugadas de Draftosaurus.";
        this.addMessage('bot', welcomeText, false);
        this.showSuggestedQuestions();
    }

    showSuggestedQuestions() {
        const suggestions = [
            "¿Cuáles son las reglas del juego?",
            "¿Cómo se calculan los puntos?",
            "¿Qué hace el dado?",
            "¿Qué estrategia me recomiendas?",
            "¿Cómo funciona el Bosque de la Semejanza?",
            "¿Qué es el bono T-Rex?",
            "¿Cuáles son las reglas del río?"
        ];

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'icebot-suggestions';
        suggestionsDiv.innerHTML = '<p style="font-size: 12px; color: var(--text-light); margin-bottom: 8px; font-weight: 600;">💡 Preguntas sugeridas:</p>';
        
        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'icebot-suggestion-btn';
            btn.textContent = suggestion;
            btn.addEventListener('click', () => {
                this.input.value = suggestion;
                this.input.focus();
                suggestionsDiv.remove();
            });
            suggestionsDiv.appendChild(btn);
        });

        this.messagesContainer.appendChild(suggestionsDiv);
        this.scrollToBottom();
    }

    saveMessages() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.messages));
        } catch (error) {
            console.error('Error al guardar mensajes en localStorage:', error);
        }
    }

    loadMessages() {
        try {
            const savedMessages = localStorage.getItem(this.storageKey);
            if (savedMessages) {
                this.messages = JSON.parse(savedMessages);
                this.messages.forEach(msg => {
                    this.renderMessage(msg.sender, msg.text);
                });
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Error al cargar mensajes:', error);
            this.messages = [];
        }
    }

    clearMessages() {
        // Guardar estadísticas antes de limpiar
        const stats = this.getConversationStats();
        console.log('Estadísticas de conversación:', stats);
        
        this.messages = [];
        localStorage.removeItem(this.storageKey);
        this.messagesContainer.innerHTML = '';
        this.welcomeShown = false;
        this.showWelcomeMessage();
    }

    // Obtener estadísticas de la conversación
    getConversationStats() {
        if (this.messages.length === 0) {
            return {
                totalMessages: 0,
                userMessages: 0,
                botMessages: 0,
                totalWords: 0,
                averageMessageLength: 0,
                firstMessage: null,
                lastMessage: null
            };
        }

        const userMessages = this.messages.filter(m => m.sender === 'user');
        const botMessages = this.messages.filter(m => m.sender === 'bot');
        const totalWords = this.messages.reduce((sum, m) => sum + (m.wordCount || 0), 0);
        const totalLength = this.messages.reduce((sum, m) => sum + (m.messageLength || 0), 0);

        return {
            totalMessages: this.messages.length,
            userMessages: userMessages.length,
            botMessages: botMessages.length,
            totalWords: totalWords,
            averageMessageLength: Math.round(totalLength / this.messages.length),
            averageWordsPerMessage: Math.round(totalWords / this.messages.length),
            firstMessage: this.messages[0]?.timestamp || null,
            lastMessage: this.messages[this.messages.length - 1]?.timestamp || null,
            conversationDuration: this.messages.length > 1 
                ? this.calculateDuration(this.messages[0]?.timestamp, this.messages[this.messages.length - 1]?.timestamp)
                : null
        };
    }

    calculateDuration(start, end) {
        if (!start || !end) return null;
        const startTime = new Date(start);
        const endTime = new Date(end);
        const diffMs = endTime - startTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        return `${diffMins} min ${diffSecs} seg`;
    }

    // Comandos especiales
    handleSpecialCommands(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        if (lowerMessage.startsWith('/')) {
            const command = lowerMessage.split(' ')[0];
            
            switch(command) {
                case '/reglas':
                    return "📖 REGLAS DE DRAFTOSAURUS - RESUMEN:\n\n" +
                           "🎯 OBJETIVO: Obtener la mayor cantidad de puntos colocando dinosaurios en recintos durante 2 rondas.\n\n" +
                           "🔄 PARTIDA: 2 rondas completas, cada jugador coloca 6 dinosaurios por ronda.\n\n" +
                           "🏞️ RECINTOS: Hay 7 recintos diferentes, cada uno con reglas específicas de puntuación:\n" +
                           "• Recintos que requieren misma especie o especies diferentes\n" +
                           "• Recintos que dan puntos por parejas o tríos\n" +
                           "• Recintos especiales con condiciones únicas\n" +
                           "• El río como recinto comodín\n\n" +
                           "🎲 DADO: El jugador activo lanza el dado que impone restricciones de colocación para los demás.\n\n" +
                           "🦖 BONO: +1 punto por cada T-Rex fuera del río.\n\n" +
                           "🏆 DESEMPATE: En caso de empate, gana quien tenga más T-Rex.\n\n" +
                           "📚 Para conocer todas las reglas detalladas de cada recinto, puntuaciones exactas y ejemplos, te recomiendo consultar el <a href=\"./manual.html\" style=\"color: var(--primary-color); text-decoration: underline; font-weight: 600;\">Manual Completo</a> 📖";
                
                case '/puntaje':
                    return "📊 SISTEMA DE PUNTAJE:\n\n" +
                           "Los puntos se calculan al final de cada ronda:\n\n" +
                           "• Recintos especiales: Según sus reglas específicas\n" +
                           "• Río: 1 punto por cada dinosaurio\n" +
                           "• Bono T-Rex: +1 punto por cada T-Rex fuera del río\n\n" +
                           "Los puntos se acumulan entre rondas. Al final, quien tenga más puntos gana. En caso de empate, gana quien tenga más T-Rex.";
                
                case '/dado':
                    return "🎲 EL DADO DE COLOCACIÓN:\n\n" +
                           "El jugador activo lanza el dado y determina dónde pueden colocar los demás:\n\n" +
                           "🌲 Bosque: Colocar en área de bosque\n" +
                           "🌱 Llanura: Colocar en área de llanura\n" +
                           "🚻 Baños: Colocar en el lado derecho\n" +
                           "☕ Cafeterías: Colocar en el lado izquierdo\n" +
                           "📦 Recinto Vacío: Colocar en un recinto sin dinosaurios\n" +
                           "🚫 Sin T-Rex: No colocar donde ya hay T-Rex\n\n" +
                           "💡 El río (recinto 7) SIEMPRE es válido, sin importar el dado.";
                
                case '/ayuda':
                    return "🆘 COMANDOS DISPONIBLES:\n\n" +
                           "/reglas - Ver todas las reglas del juego\n" +
                           "/puntaje - Explicación del sistema de puntuación\n" +
                           "/dado - Información sobre el dado\n" +
                           "/estadisticas - Ver estadísticas de tu conversación\n" +
                           "/ayuda - Mostrar esta ayuda\n\n" +
                           "💬 También puedes hacer preguntas libres sobre estrategias, recintos o cualquier duda del juego.";
                
                case '/estadisticas':
                    const stats = this.getConversationStats();
                    if (stats.totalMessages === 0) {
                        return "📊 No hay estadísticas aún. ¡Empieza a chatear conmigo! 💬";
                    }
                    return `📊 ESTADÍSTICAS DE CONVERSACIÓN:\n\n` +
                           `💬 Total de mensajes: ${stats.totalMessages}\n` +
                           `👤 Tus mensajes: ${stats.userMessages}\n` +
                           `🤖 Mis respuestas: ${stats.botMessages}\n` +
                           `📝 Total de palabras: ${stats.totalWords}\n` +
                           `📏 Promedio por mensaje: ${stats.averageWordsPerMessage} palabras\n` +
                           (stats.conversationDuration ? `⏱️ Duración: ${stats.conversationDuration}\n` : '') +
                           `\n¡Gracias por chatear conmigo! 🦖`;
                
                default:
                    return null; // No es un comando reconocido, procesar normalmente
            }
        }
        
        return null;
    }

    addMessage(sender, text, saveToStorage = true) {
        if (saveToStorage) {
            // Almacenar más información sobre cada mensaje
            this.messages.push({
                sender: sender,
                text: text,
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString('es-ES'),
                time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                messageLength: text.length,
                wordCount: text.split(/\s+/).filter(word => word.length > 0).length
            });
            this.saveMessages();
        }
        
        this.renderMessage(sender, text);
    }

    renderMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `icebot-message ${sender}`;

        if (sender === 'bot') {
            // Procesar links ANTES de escapar HTML
            // Extraer links del texto y reemplazarlos con placeholders
            const linkRegex = /<a href="([^"]+)">([^<]+)<\/a>/g;
            const links = [];
            let linkIndex = 0;
            let processedText = text.replace(linkRegex, (match, href, linkText) => {
                const placeholder = `__LINK_${linkIndex}__`;
                links.push({ href, text: linkText });
                linkIndex++;
                return placeholder;
            });
            
            // Escapar el resto del HTML
            processedText = this.escapeHtml(processedText);
            
            // Restaurar los links con formato HTML seguro
            links.forEach((link, index) => {
                const placeholder = `__LINK_${index}__`;
                const linkHtml = `<a href="${this.escapeHtml(link.href)}" target="_blank" style="color: var(--primary-color); text-decoration: underline; font-weight: 600;">${this.escapeHtml(link.text)}</a>`;
                processedText = processedText.replace(placeholder, linkHtml);
            });
            
            messageDiv.innerHTML = `
                <img src="./img/icestudio.png" alt="IceBot" class="icebot-message-avatar">
                <div class="icebot-message-content">${processedText}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="icebot-message-content">${this.escapeHtml(text)}</div>
            `;
        }

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'icebot-message bot';
        typingDiv.id = 'icebot-typing';
        typingDiv.innerHTML = `
            <img src="./img/icestudio.png" alt="IceBot" class="icebot-message-avatar">
            <div class="icebot-typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('icebot-typing');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async sendMessage() {
        const message = this.input.value.trim();
        
        if (!message) {
            return;
        }

        // Remover sugerencias si existen
        const suggestions = document.querySelector('.icebot-suggestions');
        if (suggestions) {
            suggestions.remove();
        }

        // Verificar si es un comando especial
        const commandResponse = this.handleSpecialCommands(message);
        if (commandResponse) {
            this.addMessage('user', message);
            this.input.value = '';
            this.addMessage('bot', commandResponse);
            return;
        }

        this.input.disabled = true;
        this.sendButton.disabled = true;

        this.addMessage('user', message);
        this.input.value = '';
        this.showTypingIndicator();

        try {
            const getApiBase = () => window.getApiBase ? window.getApiBase() : "http://localhost:8000";
            const backendUrl = `${getApiBase()}/api/chatbot`;
            
            // Construir historial de conversación para contexto
            const conversationHistory = this.messages
                .filter(msg => msg.sender !== 'system')
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));

            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    history: conversationHistory
                })
            });

            const text = await response.text();
            let data;
            
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('Error al parsear respuesta:', parseError);
                console.error('Respuesta del servidor:', text);
                throw new Error('El servidor respondió con un formato inválido: ' + text.substring(0, 100));
            }

            this.removeTypingIndicator();

            if (response.ok && data.reply) {
                this.addMessage('bot', data.reply);
            } else {
                const errorMsg = data.error || 'Error al comunicarse con IceBot. Por favor, intenta de nuevo.';
                this.addMessage('bot', errorMsg);
                console.error('Error del servidor:', data);
            }
        } catch (error) {
            this.removeTypingIndicator();
            console.error('Error completo:', error);
            console.error('URL intentada:', backendUrl);
            
            let errorMessage = 'Lo siento, hubo un error de conexión. ';
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += 'Por favor, verifica que:\n\n';
                errorMessage += '1. El servidor backend esté corriendo (php -S localhost:8000 -t backend/api)\n';
                errorMessage += '2. La URL del backend sea correcta\n';
                errorMessage += '3. No haya problemas de firewall bloqueando la conexión\n\n';
                errorMessage += 'Si el problema persiste, verifica la consola del navegador para más detalles.';
            } else {
                errorMessage += 'Error: ' + error.message;
            }
            
            this.addMessage('bot', errorMessage);
        } finally {
            this.input.disabled = false;
            this.sendButton.disabled = false;
            this.input.focus();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new IceBot();
    });
} else {
    new IceBot();
}

