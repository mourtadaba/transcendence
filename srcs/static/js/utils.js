// static/js/utils.js
// Centralisation des fonctions utilitaires partagées

/**
 * Récupère la valeur d'un cookie par son nom
 * @param {string} name - Nom du cookie à récupérer
 * @return {string|null} - Valeur du cookie ou null si non trouvé
 */
function getCookie(name) {
    return document.cookie.split('; ')
        .find(row => row.startsWith(name + '='))
        ?.split('=')[1] || null;
}

/**
 * Affiche un message système dans un conteneur spécifié
 * @param {string} message - Message à afficher
 * @param {HTMLElement} container - Conteneur où afficher le message (optionnel)
 */
function showSystemMessage(message, container) {
    const messagesContainer = container || document.querySelector('.messages-container');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Vérifie si une fonction existe dans l'objet window
 * @param {string} funcName - Nom de la fonction à vérifier
 * @return {boolean} - True si la fonction existe
 */
function isDefinedAndFunction(funcName) {
    return typeof window[funcName] === 'function';
}

/**
 * Gère les requêtes API avec une logique de traitement standardisée
 * @param {string} url - URL de l'endpoint API
 * @param {Object} options - Options fetch (méthode, corps, etc.)
 * @param {Function} onSuccess - Callback en cas de succès
 * @param {Function} onError - Callback en cas d'erreur
 * @return {Promise} - Promise de la requête
 */
async function apiRequest(url, options = {}, onSuccess, onError) {
    // Ajouter automatiquement le token CSRF pour les requêtes POST, PUT, PATCH, DELETE
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        if (!options.headers) options.headers = {};
        options.headers['X-CSRFToken'] = getCookie('csrftoken');
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erreur ${response.status}`);
        }
        
        const data = await response.json();
        if (onSuccess) onSuccess(data);
        return data;
    } catch (error) {
        console.error(`Erreur API (${url}):`, error);
        if (onError) onError(error);
        throw error;
    }
}

// Exporter les fonctions pour qu'elles soient accessibles depuis d'autres fichiers
window.utils = {
    getCookie,
    showSystemMessage,
    isDefinedAndFunction,
    apiRequest
};