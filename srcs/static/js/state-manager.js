// static/js/state-manager.js
// Gestionnaire d'état centralisé pour l'application

/**
 * Gestionnaire d'état global pour l'application
 * Permet de centraliser les données partagées entre les différents composants
 */
class StateManager {
    constructor() {
        // État utilisateur
        this.user = {
            id: null,
            username: null,
            isAuthenticated: false,
            profile: null
        };
        
        // État des connexions WebSocket
        this.websockets = {
            chat: {
                instance: null,
                isConnecting: false,
                isConnected: false,
                reconnectAttempts: 0,
                maxReconnectAttempts: 3,
                serverOffline: false
            },
            tournament: {
                instance: null,
                isConnecting: false,
                isConnected: false,
                reconnectAttempts: 0,
                maxReconnectAttempts: 3,
                serverOffline: false
            }
        };
        
        // État du chat
        this.chat = {
            currentRecipient: null,
            messages: {},  // Organisé par ID d'utilisateur
            unreadMessages: {},  // Compteurs de messages non lus par utilisateur
            blockedUsers: []
        };
        
        // État des tournois
        this.tournaments = {
            currentTournament: null,
            list: [],
            participatingTournaments: []
        };
        
        // Liste des écouteurs à notifier lors des changements d'état
        this.listeners = [];
    }
    
    /**
     * Initialise l'état utilisateur
     * @returns {Promise} - Promesse résolue lorsque l'utilisateur est initialisé
     */
    async initUser() {
        try {
            const response = await fetch('/api/check-auth/');
            const data = await response.json();
            
            if (data.is_authenticated) {
                this.user.isAuthenticated = true;
                
                // Si authentifié, récupérer les détails du profil
                const profileResponse = await fetch('/api/profile/');
                const profileData = await profileResponse.json();
                
                this.user.id = profileData.id;
                this.user.username = profileData.username;
                this.user.profile = profileData;
                
                // Si les WebSockets sont activés, initialiser les connexions
                this.initWebSockets();
            } else {
                this.user.isAuthenticated = false;
                this.user.id = null;
                this.user.username = null;
                this.user.profile = null;
            }
            
            // Notifier les écouteurs du changement d'état
            this.notifyListeners('user');
            
            return this.user;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'utilisateur:', error);
            throw error;
        }
    }
    
    /**
     * Initialise les connexions WebSocket
     */
    initWebSockets() {
        if (!this.user.isAuthenticated) return;
        
        // Initialiser la connexion WebSocket pour le chat
        this.initChatWebSocket();
        
        // Initialiser la connexion WebSocket pour les tournois
        this.initTournamentWebSocket();
    }
    
    /**
     * Initialise la connexion WebSocket pour le chat
     */
    initChatWebSocket() {
        const ws = this.websockets.chat;
        
        if (ws.isConnecting || ws.serverOffline) return;
        if (ws.instance && ws.instance.readyState === WebSocket.OPEN) return;
        
        ws.isConnecting = true;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws.instance = new WebSocket(`${protocol}//${window.location.host}/ws/chat/`);
        
        ws.instance.onopen = () => {
            console.log('Chat WebSocket connecté');
            ws.isConnecting = false;
            ws.isConnected = true;
            ws.reconnectAttempts = 0;
            ws.serverOffline = false;
            this.notifyListeners('websockets.chat');
        };
        
        ws.instance.onclose = (e) => {
            console.log('Chat WebSocket déconnecté, code:', e.code);
            ws.isConnecting = false;
            ws.isConnected = false;
            
            // Codes normaux de fermeture (1000, 1001) ne déclenchent pas de reconnexion
            const isNormalClosure = e.code === 1000 || e.code === 1001;
            
            if (!isNormalClosure) {
                ws.reconnectAttempts++;
                
                if (ws.reconnectAttempts >= ws.maxReconnectAttempts) {
                    ws.serverOffline = true;
                } else {
                    // Tentative de reconnexion avec délai exponentiel
                    const reconnectDelay = Math.min(1000 * Math.pow(2, ws.reconnectAttempts - 1), 30000);
                    setTimeout(() => this.initChatWebSocket(), reconnectDelay);
                }
            }
            
            this.notifyListeners('websockets.chat');
        };
        
        ws.instance.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                this.handleWebSocketMessage(data, 'chat');
            } catch (error) {
                console.error('Erreur lors du traitement du message WebSocket chat:', error);
            }
        };
        
        ws.instance.onerror = (error) => {
            console.error('Erreur WebSocket chat:', error);
            ws.isConnecting = false;
            this.notifyListeners('websockets.chat');
        };
    }
    
    /**
     * Initialise la connexion WebSocket pour les tournois
     */
    initTournamentWebSocket() {
        const ws = this.websockets.tournament;
        
        if (ws.isConnecting || ws.serverOffline) return;
        if (ws.instance && ws.instance.readyState === WebSocket.OPEN) return;
        
        ws.isConnecting = true;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws.instance = new WebSocket(`${protocol}//${window.location.host}/ws/tournament/`);
        
        ws.instance.onopen = () => {
            console.log('Tournament WebSocket connecté');
            ws.isConnecting = false;
            ws.isConnected = true;
            ws.reconnectAttempts = 0;
            ws.serverOffline = false;
            this.notifyListeners('websockets.tournament');
        };
        
        ws.instance.onclose = (e) => {
            console.log('Tournament WebSocket déconnecté, code:', e.code);
            ws.isConnecting = false;
            ws.isConnected = false;
            
            // Codes normaux de fermeture (1000, 1001) ne déclenchent pas de reconnexion
            const isNormalClosure = e.code === 1000 || e.code === 1001;
            
            if (!isNormalClosure) {
                ws.reconnectAttempts++;
                
                if (ws.reconnectAttempts >= ws.maxReconnectAttempts) {
                    ws.serverOffline = true;
                } else {
                    // Tentative de reconnexion avec délai exponentiel
                    const reconnectDelay = Math.min(1000 * Math.pow(2, ws.reconnectAttempts - 1), 30000);
                    setTimeout(() => this.initTournamentWebSocket(), reconnectDelay);
                }
            }
            
            this.notifyListeners('websockets.tournament');
        };
        
        ws.instance.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                this.handleWebSocketMessage(data, 'tournament');
            } catch (error) {
                console.error('Erreur lors du traitement du message WebSocket tournament:', error);
            }
        };
        
        ws.instance.onerror = (error) => {
            console.error('Erreur WebSocket tournament:', error);
            ws.isConnecting = false;
            this.notifyListeners('websockets.tournament');
        };
    }
    
    /**
     * Gère les messages reçus via WebSocket
     * @param {Object} data - Données du message
     * @param {string} source - Source du message ('chat' ou 'tournament')
     */
    handleWebSocketMessage(data, source) {
        console.log(`Message WebSocket (${source}) reçu:`, data);
        
        switch (data.type) {
            case 'chat_message':
                this.handleChatMessage(data);
                break;
            case 'game_invite':
                this.handleGameInvite(data);
                break;
            case 'tournament_update':
                this.handleTournamentUpdate(data);
                break;
            case 'tournament_match_notification':
                this.handleMatchNotification(data);
                break;
            default:
                console.warn(`Type de message inconnu: ${data.type}`);
        }
    }
    
    /**
     * Gère un message de chat
     * @param {Object} data - Données du message
     */
    handleChatMessage(data) {
        const senderId = parseInt(data.sender_id);
        const recipientId = parseInt(data.recipient_id);
        const isSentByMe = data.is_sent === true;
        
        // Déterminer l'ID de l'autre utilisateur (avec qui on discute)
        const otherUserId = isSentByMe ? recipientId : senderId;
        
        // Initialiser le tableau de messages pour cet utilisateur si nécessaire
        if (!this.chat.messages[otherUserId]) {
            this.chat.messages[otherUserId] = [];
        }
        
        // Ajouter le message au tableau
        this.chat.messages[otherUserId].push({
            content: data.message,
            sender: data.sender,
            sender_id: senderId,
            recipient_id: recipientId,
            timestamp: new Date(),
            is_sent: isSentByMe
        });
        
        // Si ce n'est pas un message envoyé par nous ET que ce n'est pas la conversation active,
        // incrémenter le compteur de messages non lus
        if (!isSentByMe && (!this.chat.currentRecipient || this.chat.currentRecipient.id !== senderId)) {
            if (!this.chat.unreadMessages[senderId]) {
                this.chat.unreadMessages[senderId] = 0;
            }
            this.chat.unreadMessages[senderId]++;
        }
        
        // Notifier les écouteurs du changement d'état
        this.notifyListeners('chat');
    }
    
    /**
     * Gère une invitation de jeu
     * @param {Object} data - Données de l'invitation
     */
    handleGameInvite(data) {
        // Créer un événement personnalisé pour l'invitation de jeu
        const event = new CustomEvent('gameInvite', { detail: data });
        document.dispatchEvent(event);
    }
    
    /**
     * Gère une mise à jour de tournoi
     * @param {Object} data - Données de la mise à jour
     */
    handleTournamentUpdate(data) {
        // Créer un événement personnalisé pour la mise à jour de tournoi
        const event = new CustomEvent('tournamentUpdate', { detail: data });
        document.dispatchEvent(event);
    }
    
    /**
     * Gère une notification de match
     * @param {Object} data - Données de la notification
     */
    handleMatchNotification(data) {
        // Créer un événement personnalisé pour la notification de match
        const event = new CustomEvent('matchNotification', { detail: data });
        document.dispatchEvent(event);
    }
    
    /**
     * Envoie un message via WebSocket
     * @param {Object} data - Données à envoyer
     * @param {string} type - Type de WebSocket ('chat' ou 'tournament')
     * @returns {boolean} - true si le message a été envoyé, false sinon
     */
    sendWebSocketMessage(data, type = 'chat') {
        const ws = this.websockets[type];
        
        if (ws.instance && ws.instance.readyState === WebSocket.OPEN) {
            ws.instance.send(JSON.stringify(data));
            return true;
        } else {
            console.warn(`Impossible d'envoyer le message, WebSocket ${type} non connecté`);
            return false;
        }
    }
    
    /**
     * Définit le destinataire actuel du chat
     * @param {Object} recipient - Destinataire (avec id et username)
     */
    setCurrentRecipient(recipient) {
        this.chat.currentRecipient = recipient;
        
        // Réinitialiser le compteur de messages non lus pour ce destinataire
        if (recipient && recipient.id) {
            this.chat.unreadMessages[recipient.id] = 0;
        }
        
        this.notifyListeners('chat');
    }
    
    /**
     * Récupère les messages pour un utilisateur spécifique
     * @param {number} userId - ID de l'utilisateur
     * @returns {Array} - Tableau de messages
     */
    getMessagesForUser(userId) {
        return this.chat.messages[userId] || [];
    }
    
    /**
     * Ajoute un écouteur pour les changements d'état
     * @param {Function} callback - Fonction à appeler lors d'un changement d'état
     * @param {string} [keyPath] - Chemin de la propriété à surveiller (optionnel)
     */
    addListener(callback, keyPath = null) {
        this.listeners.push({ callback, keyPath });
    }
    
    /**
     * Supprime un écouteur
     * @param {Function} callback - Fonction à supprimer
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener.callback !== callback);
    }
    
    /**
     * Notifie les écouteurs d'un changement d'état
     * @param {string} keyPath - Chemin de la propriété modifiée
     */
    notifyListeners(keyPath) {
        this.listeners.forEach(listener => {
            // Si l'écouteur est intéressé par toutes les modifications ou spécifiquement par ce keyPath
            if (!listener.keyPath || listener.keyPath === keyPath || keyPath.startsWith(listener.keyPath)) {
                listener.callback(this, keyPath);
            }
        });
    }
}

// Créer et exporter une instance unique du gestionnaire d'état
window.appState = new StateManager();

// Initialiser l'état utilisateur au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.appState.initUser().catch(error => {
        console.error('Erreur lors de l\'initialisation de l\'état:', error);
    });
});