// tournament-component.js

// Fonction principale pour charger la page de tournois
window.loadTournamentPage = async function() {
    try {
        // Vérifier l'authentification
        const authResponse = await fetch('/api/check-auth/');
        const authData = await authResponse.json();
        
        if (!authData.is_authenticated) {
            router.navigate('/login');
            return;
        }
        
        // Afficher un indicateur de chargement
        document.querySelector('#app').innerHTML = '<div class="loading">Chargement des tournois...</div>';
            
        // Récupérer la liste des tournois
        const response = await fetch('/tournaments/api/tournaments/');
        const data = await response.json();
        
        // Générer le HTML de l'interface des tournois
        document.querySelector('#app').innerHTML = generateTournamentInterface(data);
        
        // Initialiser les fonctionnalités
        initTournamentFunctionality();
    } catch (error) {
        console.error('Erreur lors du chargement des tournois:', error);
        document.querySelector('#app').innerHTML = 
            '<div class="alert alert-danger">Erreur lors du chargement des tournois</div>';
    }
};

// Fonction pour charger les détails d'un tournoi spécifique
window.loadTournamentDetails = async function(tournamentId) {
    try {
        // Vérifier l'authentification
        const authResponse = await fetch('/api/check-auth/');
        const authData = await authResponse.json();
        
        if (!authData.is_authenticated) {
            router.navigate('/login');
            return;
        }
        
        // Afficher un indicateur de chargement
        document.querySelector('#app').innerHTML = '<div class="loading">Chargement du tournoi...</div>';
        
        // Récupérer les détails du tournoi
        const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            document.querySelector('#app').innerHTML = 
                `<div class="alert alert-danger">${data.message || 'Erreur lors du chargement du tournoi'}</div>`;
            return;
        }
        
        // Générer le HTML des détails du tournoi
        document.querySelector('#app').innerHTML = generateTournamentDetailsInterface(data.tournament);
        
        // Initialiser les fonctionnalités spécifiques
        initTournamentDetailsEvents(data.tournament);
    } catch (error) {
        console.error('Erreur lors du chargement des détails du tournoi:', error);
        document.querySelector('#app').innerHTML = 
            '<div class="alert alert-danger">Erreur lors du chargement des détails du tournoi</div>';
    }
};

// Générer l'interface HTML de la liste des tournois
function generateTournamentInterface(data) {
    return `
    <div class="tournament-interface">
        <h2>Tournois</h2>
        
        <div class="tournament-actions">
            <button id="create-tournament-btn" class="btn btn-primary">Creer un tournoi</button>
        </div>
        
        <div id="create-tournament-form" style="display: none;" class="card mb-4 p-3">
            <h3>Créer un nouveau tournoi</h3>
            <form id="new-tournament-form">
                <div class="form-group">
                    <label for="tournament-name">Nom du tournoi</label>
                    <input type="text" class="form-control" id="tournament-name" placeholder="Entrez un nom pour le tournoi" required>
                </div>
                <button type="submit" class="btn btn-success">Créer</button>
                <button type="button" id="cancel-create-btn" class="btn btn-secondary">Annuler</button>
            </form>
        </div>
        
        <div class="tournaments-list">
            ${data.tournaments.length > 0 ? `
                <h3>Tournois disponibles</h3>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Créateur</th>
                                <th>Participants</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.tournaments.map(tournament => `
                                <tr>
                                    <td>
                                        <a href="#" class="tournament-link" data-tournament-id="${tournament.id}">
                                            ${tournament.name}
                                        </a>
                                    </td>
                                    <td>${tournament.created_by}</td>
                                    <td>${tournament.participants_count}</td>
                                    <td>${getStatusDisplay(tournament.status)}</td>
                                    <td>
                                        <div class="btn-group">
                                            <button class="btn btn-sm btn-info view-tournament-btn" data-tournament-id="${tournament.id}">
                                                Voir
                                            </button>
                                            ${tournament.status === 'open' ? `
                                                ${!tournament.is_participant ? `
                                                    <button class="btn btn-sm btn-success join-tournament-btn" data-tournament-id="${tournament.id}">
                                                        Rejoindre
                                                    </button>
                                                ` : `
                                                    <button class="btn btn-sm btn-warning leave-tournament-btn" data-tournament-id="${tournament.id}">
                                                        Quitter
                                                    </button>
                                                `}
                                                ${tournament.is_creator ? `
                                                    <button class="btn btn-sm btn-primary start-tournament-btn" data-tournament-id="${tournament.id}">
                                                        Demarrer
                                                    </button>
                                                ` : ''}
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="empty-state">
                    <p>Aucun tournoi disponible. Créez-en un nouveau !</p>
                </div>
            `}
        </div>
    </div>
    `;
}

// Générer l'interface HTML des détails d'un tournoi
function generateTournamentDetailsInterface(tournament) {
    // Récupérer l'état de progression du tournoi
    const rounds = Object.keys(tournament.rounds || {}).sort((a, b) => parseInt(a) - parseInt(b));
    const numRounds = rounds.length;
    
    return `
    <div class="tournament-details">
        <div class="tournament-header">
            <h2>${tournament.name}</h2>
            <div class="tournament-info">
                <p>Créé par: ${tournament.created_by}</p>
                <p>Statut: ${getStatusDisplay(tournament.status)}</p>
                ${tournament.winner ? `<p>Gagnant: ${tournament.winner}</p>` : ''}
            </div>
            
            <div class="tournament-actions">
                <button id="back-to-tournaments-btn" class="btn btn-secondary">
                    Retour à la liste
                </button>
                
                ${tournament.status === 'open' ? `
                    ${!tournament.is_participant ? `
                        <button id="join-tournament-btn" class="btn btn-success" data-tournament-id="${tournament.id}">
                            Rejoindre
                        </button>
                    ` : `
                        <button id="leave-tournament-btn" class="btn btn-warning" data-tournament-id="${tournament.id}">
                            Quitter
                        </button>
                    `}
                    
                    ${tournament.is_creator ? `
                        <button id="start-tournament-btn" class="btn btn-primary" data-tournament-id="${tournament.id}" 
                            ${tournament.participants.length < 2 ? 'disabled' : ''}>
                            Démarrer le tournoi
                        </button>
                    ` : ''}
                ` : ''}
            </div>
        </div>
        
        <div class="tournament-participants">
            <h3>Participants (${tournament.participants.length})</h3>
            <div class="participants-list">
                ${tournament.participants.map(participant => `
                    <div class="participant-card">
                        <span class="participant-name">${participant.username}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${tournament.status !== 'open' ? `
            <div class="tournament-bracket">
                <h3>Matchs du tournoi</h3>
                
                <div class="bracket-container">
                    ${rounds.map(round => `
                        <div class="bracket-round">
                            <h4>Tour ${round}</h4>
                            <div class="round-matches">
                                ${tournament.rounds[round].map(match => `
                                    <div class="match-card ${match.status}">
                                        <div class="player player-1 ${match.winner_id === match.player1.id ? 'winner' : ''}">
                                            <span class="player-name">${match.player1.name}</span>
                                            <span class="player-score">${match.score.player1}</span>
                                        </div>
                                        <div class="vs">VS</div>
                                        <div class="player player-2 ${match.winner_id === match.player2.id ? 'winner' : ''}">
                                            <span class="player-name">${match.player2.name}</span>
                                            <span class="player-score">${match.score.player2}</span>
                                        </div>
                                        ${match.status === 'pending' && (match.player1.id === window.currentUserId || match.player2.id === window.currentUserId) ? `
                                            <button class="btn btn-sm btn-primary start-match-btn" data-match-id="${match.id}">
                                                Démarrer le match
                                            </button>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    </div>
    `;
}

// Convertir le statut en affichage lisible
function getStatusDisplay(status) {
    const statusMap = {
        'open': 'Ouvert aux inscriptions',
        'in_progress': 'En cours',
        'completed': 'Terminé',
        'canceled': 'Annulé'
    };
    
    return statusMap[status] || status;
}

// Initialiser les fonctionnalités de la page des tournois
function initTournamentFunctionality() {
    // pour suivre si l'événement a déjà été attaché
    if (document.querySelector('#app').hasAttribute('data-tournament-init-done')) {
        return;
    }
    document.querySelector('#app').setAttribute('data-tournament-init-done', 'true');
    
    // Marquer que les événements ont été attachés
    document.querySelector('#app').setAttribute('data-tournament-events', 'true')

    // Vérifier si le gestionnaire d'état est disponible
    if (!window.appState) {
        console.error("Gestionnaire d'état (appState) non disponible. Vérifiez que state-manager.js est chargé.");
        
        // Fallback: créer un gestionnaire d'état basique pour éviter les erreurs
        window.appState = {
            addListener: function() {},
            user: { id: null, username: null },
            tournaments: { list: [], currentTournament: null }
        };
    }

     // Écouter les changements d'état liés aux tournois
     window.appState.addListener(handleTournamentStateChange, 'tournaments');
    
     // Écouter les événements de notification
     document.addEventListener('tournamentUpdate', handleTournamentUpdateEvent);
     document.addEventListener('matchNotification', handleMatchNotificationEvent);
    
    fetch('/api/profile/')
        .then(response => response.json())
        .then(data => {
            window.currentUserId = data.id;
        })
        .catch(error => {
            console.error('Erreur lors de la récupération du profil:', error);
        });

    // Utiliser la délégation d'événements pour tous les boutons
    document.querySelector('#app').addEventListener('click', function(event) {
        // Gestion du bouton "Voir" et des liens vers les tournois
        if (event.target.classList.contains('view-tournament-btn') || 
            event.target.classList.contains('tournament-link')) {
            event.preventDefault();
            const tournamentId = event.target.getAttribute('data-tournament-id');
            if (tournamentId) {
                console.log('Navigation vers le tournoi:', tournamentId);
                router.navigate(`/tournaments/${tournamentId}`);
            }
        }
    });
    
    // Bouton pour afficher le formulaire de création
    document.querySelector('#app').addEventListener('click', function(event) {
        if (event.target.id === 'create-tournament-btn') {
            document.getElementById('create-tournament-form').style.display = 'block';
        }
        
        if (event.target.id === 'cancel-create-btn') {
            document.getElementById('create-tournament-form').style.display = 'none';
        }
    });
    
    
    // Gestion du formulaire de création
    document.querySelector('#app').addEventListener('submit', async function(event) {
        if (event.target.id === 'new-tournament-form') {
            event.preventDefault();
        
            const tournamentName = document.getElementById('tournament-name').value.trim();
            
            if (!tournamentName) {
                alert('Le nom du tournoi ne peut pas être vide');
                return;
            }
        
        
            try {
                const response = await fetch('/tournaments/api/tournaments/create/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({ name: tournamentName })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Recharger la page des tournois
                    loadTournamentPage();
                } else {
                    alert('Erreur lors de la création du tournoi: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors de la création du tournoi:', error);
                alert('Une erreur est survenue lors de la création du tournoi');
            }
        }
    });
    
    
    // Boutons pour rejoindre un tournoi - utilisation de la délégation d'événements
    document.querySelector('#app').addEventListener('click', async function(event) {
        if (event.target.classList.contains('join-tournament-btn')) {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/join/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert(data.message);
                    loadTournamentPage();
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors de la participation au tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
    });
    
    // Boutons pour quitter un tournoi - utilisation de la délégation d'événements
    document.querySelector('#app').addEventListener('click', async function(event) {
        if (event.target.classList.contains('leave-tournament-btn')) {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            if (!confirm('Êtes-vous sûr de vouloir quitter ce tournoi ?')) {
                return;
            }
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/leave/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert(data.message);
                    loadTournamentPage();
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors de la sortie du tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
    });
    
    // Boutons pour démarrer un tournoi - utilisation de la délégation d'événements
    document.querySelector('#app').addEventListener('click', async function(event) {
        if (event.target.classList.contains('start-tournament-btn')) {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            if (!confirm('Êtes-vous sûr de vouloir démarrer ce tournoi ? Cette action est irréversible.')) {
                return;
            }
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/start/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert('Le tournoi a démarré avec succès');
                    router.navigate(`/tournaments/${tournamentId}`);
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors du démarrage du tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
    });

    // Initialiser la connexion WebSocket pour les tournois 
    initTournamentWebSocket();
}

// Initialiser les événements pour la page de détails d'un tournoi
function initTournamentDetailsEvents(tournament) {
    if (document.querySelector('#app').hasAttribute('data-tournament-detail-events')) {
        console.log('Événements de détail de tournoi déjà initialisés, ignoré.');
        return;
    }
    
    // Marquer que les événements ont été attachés
    document.querySelector('#app').setAttribute('data-tournament-detail-events', 'true')
    // Récupérer l'ID d'utilisateur actuel s'il n'est pas déjà défini
    if (!window.currentUserId) {
        fetch('/api/profile/')
            .then(response => response.json())
            .then(data => {
                window.currentUserId = data.id;
            })
            .catch(error => {
                console.error('Erreur lors de la récupération du profil:', error);
            });
    }

    // Bouton de retour
    document.getElementById('back-to-tournaments-btn').addEventListener('click', () => {
        router.navigate('/tournaments');
    });
    
    // Utiliser la délégation d'événements pour tous les boutons dans les détails du tournoi
    document.querySelector('#app').addEventListener('click', async function(event) {
        // Bouton pour rejoindre le tournoi
        if (event.target.id === 'join-tournament-btn') {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/join/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert(data.message);
                    loadTournamentDetails(tournamentId);
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors de la participation au tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
        
        // Bouton pour quitter le tournoi
        if (event.target.id === 'leave-tournament-btn') {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            if (!confirm('Êtes-vous sûr de vouloir quitter ce tournoi ?')) {
                return;
            }
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/leave/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert(data.message);
                    loadTournamentDetails(tournamentId);
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors de la sortie du tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
        
        // Bouton pour démarrer le tournoi
        if (event.target.id === 'start-tournament-btn') {
            const tournamentId = event.target.getAttribute('data-tournament-id');
            
            if (!confirm('Êtes-vous sûr de vouloir démarrer ce tournoi ? Cette action est irréversible.')) {
                return;
            }
            
            try {
                const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/start/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert('Le tournoi a démarré avec succès');
                    loadTournamentDetails(tournamentId);
                } else {
                    alert('Erreur: ' + data.message);
                }
            } catch (error) {
                console.error('Erreur lors du démarrage du tournoi:', error);
                alert('Une erreur est survenue');
            }
        }
        
        // Boutons pour démarrer un match
        if (event.target.classList.contains('start-match-btn')) {
            // Éviter les doubles clics
            if (event.target.disabled) {
                console.log("Bouton déjà désactivé, ignorer le clic");
                return;
            }
            
            // Désactiver le bouton
            event.target.disabled = true;
            console.log("Bouton désactivé pour éviter les doubles clics");
            
            const matchId = event.target.getAttribute('data-match-id');
            console.log(`Tentative de démarrage du match: ${matchId}`);
            
            try {
                const response = await fetch(`/tournaments/api/matches/${matchId}/start/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });

                
                console.log("Statut de la réponse:", response.status);
        
                // Pour le débogage, afficher le texte brut
                const responseText = await response.text();
                console.log("Contenu de la réponse:", responseText);
                
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    console.error("Erreur de parsing JSON:", e);
                    alert("Erreur de communication avec le serveur");
                    event.target.disabled = false;  // Réactiver le bouton
                    return;
                }
                
                if (data.status === 'success') {
                    if (data.redirect_url) {
                        window.location.href = data.redirect_url;
                    } else {
                        alert('Match démarré');
                        loadTournamentDetails(tournament.id);
                    }
                } else {
                    alert('Erreur: ' + data.message);
                    event.target.disabled = false; 
                }
            } catch (error) {
                console.error('Erreur complète:', error);
                alert('Une erreur est survenue lors du démarrage du match');
                event.target.disabled = false;
            }
        }
    });
}

// Fonction pour enregistrer le résultat d'un match
window.recordMatchResult = async function(matchId, scorePlayer1, scorePlayer2) {
    try {
        const response = await fetch(`/tournaments/api/matches/${matchId}/score/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                score_player1: scorePlayer1,
                score_player2: scorePlayer2
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            router.navigate(`/tournaments/${data.tournament_data.id}`);
            return true;
        } else {
            alert('Erreur: ' + data.message);
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du score:', error);
        alert('Une erreur est survenue lors de l\'enregistrement du score');
        return false;
    }
}

// Dans tournament-component.js ou state-manager.js + logs
function initTournamentWebSocket() {
    console.log("Tentative de connexion au WebSocket de tournoi...");
    const tournamentSocket = new WebSocket('ws://' + window.location.host + '/ws/tournament/');
    
    tournamentSocket.onopen = function() {
        console.log("WebSocket de tournoi connecté avec succès");
    };
    
    tournamentSocket.onerror = function(error) {
        console.error("Erreur de connexion WebSocket tournoi:", error);
    };
    
    tournamentSocket.onclose = function(e) {
        console.log("WebSocket de tournoi fermé, code:", e.code);
    };
    
    tournamentSocket.onmessage = function(e) {
        console.log("Message WebSocket de tournoi reçu:", e.data);
        const data = JSON.parse(e.data);
        if (data.type === 'tournament_update') {
            console.log("Notification de tournoi reçue:", data);
            showTournamentNotification(data);
        } else if (data.type === 'tournament_match_notification') {
            if (data.redirect_url) {
                setTimeout(() => {
                    window.location.href = data.redirect_url;
                }, 500);
            } else {
                // Afficher une notification classique si pas d'URL de redirection
                showMatchNotification(data.message);
            }
        }
    };
}

// Fonctions pour les notifications de tournoi
function showTournamentNotification(data) {
    console.log("Notification de tournoi reçue:", data);
    
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = 'tournament-notification';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
    notification.style.minWidth = '250px';
    notification.style.transition = 'opacity 0.5s';
    
    notification.innerHTML = `
        <div class="notification-content">
            <span>${data.message || 'Le tournoi a été mis à jour'}</span>
            <button class="close-notification" style="background: none; border: none; color: white; 
                     float: right; font-size: 20px; cursor: pointer;">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Afficher notification système si autorisé
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Notification de tournoi", {
            body: data.message || 'Le tournoi a été mis à jour'
        });
    }
    
    // Fermer la notification après un délai
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 5000);
    
    // Fermer manuellement la notification
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
    
    // Si un tournoi est mis à jour et qu'on est sur sa page, rafraîchir les données
    if (data.tournament_id && window.location.pathname.includes(`/tournaments/${data.tournament_id}`)) {
        window.loadTournamentDetails(data.tournament_id);
    }
}

function showMatchNotification(data) {
    console.log("Notification de match reçue:", data);
    
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = 'match-notification';
    notification.style.position = 'fixed';
    notification.style.top = '100px';
    notification.style.right = '10px';
    notification.style.backgroundColor = '#2196F3';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
    notification.style.minWidth = '300px';
    notification.style.transition = 'opacity 0.5s';
    
    notification.innerHTML = `
        <div class="notification-content">
            <span>${data.message || 'Notification de match'}</span>
            <div class="notification-actions" style="margin-top: 10px;">
                <button class="start-match-btn" data-match-id="${data.match_id}" 
                        style="background-color: #4CAF50; color: white; border: none; 
                        padding: 5px 10px; margin-right: 10px; cursor: pointer; border-radius: 3px;">
                    Démarrer le match
                </button>
                <button class="close-notification" style="background: none; border: none; color: white; 
                         font-size: 20px; cursor: pointer; float: right;">×</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Notification système
    if ("Notification" in window && Notification.permission === "granted") {
        const notif = new Notification("Match prêt !", {
            body: data.message || 'Votre match est prêt!'
        });
        
        notif.onclick = function() {
            window.focus();
            this.close();
        };
    }
    
    // Ajouter le gestionnaire d'événement pour démarrer le match
    notification.querySelector('.start-match-btn').addEventListener('click', async () => {
        const matchId = data.match_id;

        if (!matchId) {
            console.error("ID de match manquant dans les données de notification:", data);
            alert("Impossible de démarrer le match : ID manquant");
            return;
        }
        
        console.log("Tentative de démarrage du match:", matchId)
        
        try {
            const response = await fetch(`/tournaments/api/matches/${matchId}/start/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });
            
            const responseData = await response.json();
            
            if (responseData.status === 'success') {
                if (responseData.redirect_url) {
                    window.location.href = responseData.redirect_url;
                }
            } else {
                alert('Erreur: ' + responseData.message);
            }
        } catch (error) {
            console.error('Erreur lors du démarrage du match:', error);
            alert('Une erreur est survenue');
        }
        
        notification.remove();
    });
    
    // Fermer la notification
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
}

// Demander l'autorisation pour les notifications
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        const notificationBtn = document.createElement('button');
        notificationBtn.textContent = "Activer les notifications";
        notificationBtn.style.position = 'fixed';
        notificationBtn.style.bottom = '20px';
        notificationBtn.style.right = '20px';
        notificationBtn.style.backgroundColor = '#4CAF50';
        notificationBtn.style.color = 'white';
        notificationBtn.style.border = 'none';
        notificationBtn.style.padding = '10px 15px';
        notificationBtn.style.borderRadius = '5px';
        notificationBtn.style.cursor = 'pointer';
        notificationBtn.style.zIndex = '999';
        
        notificationBtn.onclick = () => {
            Notification.requestPermission();
            notificationBtn.remove();
        };
        
        document.body.appendChild(notificationBtn);
    }
}

function handleTournamentStateChange(state, keyPath) {
    // Mettre à jour l'interface utilisateur en fonction des changements
    if (state.tournaments.list.length > 0) {
        updateTournamentList(state.tournaments.list);
    }
    
    if (state.tournaments.currentTournament) {
        updateTournamentDetails(state.tournaments.currentTournament);
    }
}

function handleTournamentUpdateEvent(event) {
    const data = event.detail;
    showTournamentNotification(data);
}

function handleMatchNotificationEvent(event) {
    const data = event.detail;
    showMatchNotification(data);
}
// Exposer les fonctions globalement
window.showTournamentNotification = showTournamentNotification;
window.showMatchNotification = showMatchNotification;
window.requestNotificationPermission = requestNotificationPermission;