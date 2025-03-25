import random
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def generate_tournament_matches(tournament):
    """
    Génère les matchs du premier tour d'un tournoi.
    Gère correctement un nombre impair de participants grâce aux exemptions.
    """
    from .models import TournamentMatch
    
    with transaction.atomic():
        # Récupérer les participants et mélanger la liste
        participants = list(tournament.participants.all())
        
        # Enregistrer le nombre de participants pour référence
        logger.info(f"Génération des matchs pour le tournoi {tournament.name} avec {len(participants)} participants")
        
        # Mélanger pour éviter les biais
        random.shuffle(participants)
        
        # Nombre de participants
        n_participants = len(participants)
        
        # Si nombre impair, ajouter un "bye" (exemption)
        bye_needed = (n_participants % 2 != 0)
        
        # Calcul du nombre de matchs
        n_matches = n_participants // 2
        if bye_needed:
            n_matches += 1
            logger.info(f"Nombre impair de participants ({n_participants}). Un joueur recevra une exemption.")
        
        # Création des matchs
        created_matches = []
        
        for i in range(n_matches):
            # Dernier match avec un "bye" si nombre impair
            if bye_needed and i == n_matches - 1:
                player1 = participants[i * 2]
                player2 = None
                logger.info(f"Exemption attribuée à {player1.username}")
                
                match = TournamentMatch.objects.create(
                    tournament=tournament,
                    player1=player1,
                    player2=None,  # Exemption (bye)
                    round=tournament.current_round,
                    match_order=i,
                    status='completed',  # Joueur 1 gagne automatiquement
                    winner=player1,
                    score_player1=1,
                    score_player2=0,
                    start_time=timezone.now(),
                    end_time=timezone.now()
                )
            else:
                # Match normal entre deux joueurs
                player1 = participants[i * 2]
                player2 = participants[i * 2 + 1]
                
                match = TournamentMatch.objects.create(
                    tournament=tournament,
                    player1=player1,
                    player2=player2,
                    round=tournament.current_round,
                    match_order=i
                )
                
                logger.info(f"Match créé: {player1.username} vs {player2.username} (Round {tournament.current_round})")
            
            created_matches.append(match)
        
        return created_matches

def generate_next_round_matches(tournament, winners):
    """
    Génère les matchs pour le prochain tour du tournoi.
    Gère correctement le cas d'un nombre impair de gagnants.
    """
    from .models import TournamentMatch
    
    with transaction.atomic():
        # Log le nombre de gagnants
        logger.info(f"Génération des matchs pour le round {tournament.current_round} avec {len(winners)} gagnants")
        
        # Mélanger la liste des gagnants pour éviter tout biais
        random.shuffle(winners)
        
        # Nombre de gagnants
        n_winners = len(winners)
        
        # Si nombre impair, un joueur reçoit une exemption
        bye_needed = (n_winners % 2 != 0)
        
        # Calcul du nombre de matchs
        n_matches = n_winners // 2
        if bye_needed:
            n_matches += 1
            logger.info(f"Nombre impair de gagnants ({n_winners}). Un joueur recevra une exemption.")
        
        # Création des matchs
        created_matches = []
        
        for i in range(n_matches):
            # Dernier match avec un "bye" si nombre impair
            if bye_needed and i == n_matches - 1:
                player1 = winners[i * 2]
                player2 = None
                logger.info(f"Exemption attribuée à {player1.username}")
                
                match = TournamentMatch.objects.create(
                    tournament=tournament,
                    player1=player1,
                    player2=None,  # Exemption (bye)
                    round=tournament.current_round,
                    match_order=i,
                    status='completed',  # Joueur 1 gagne automatiquement
                    winner=player1,
                    score_player1=1,
                    score_player2=0,
                    start_time=timezone.now(),
                    end_time=timezone.now()
                )
            else:
                # Match normal entre deux joueurs
                if i * 2 + 1 < len(winners):  # Vérification pour éviter les erreurs d'index
                    player1 = winners[i * 2]
                    player2 = winners[i * 2 + 1]
                    
                    match = TournamentMatch.objects.create(
                        tournament=tournament,
                        player1=player1,
                        player2=player2,
                        round=tournament.current_round,
                        match_order=i
                    )
                    
                    logger.info(f"Match créé: {player1.username} vs {player2.username} (Round {tournament.current_round})")
                else:
                    # Gestion d'un cas exceptionnel (ne devrait pas arriver)
                    logger.error(f"Erreur d'index lors de la création des matchs - i={i}, winners={len(winners)}")
                    continue
            
            created_matches.append(match)
        
        return created_matches
                
def get_tournament_bracket(tournament_id):
    """
    Récupère et formate les données du tournoi pour l'affichage du bracket.
    """
    from .models import Tournament, TournamentMatch
    
    try:
        tournament = Tournament.objects.get(id=tournament_id)
    except Tournament.DoesNotExist:
        return None
    
    # Récupérer tous les matchs du tournoi, organisés par tour
    matches = TournamentMatch.objects.filter(tournament=tournament).order_by('round', 'match_order')
    
    # Organiser les matchs par tour
    rounds = {}
    for match in matches:
        round_num = match.round
        if round_num not in rounds:
            rounds[round_num] = []
        
        # Formater les données du match
        match_data = {
            'id': str(match.id),
            'player1': {
                'id': match.player1.id if match.player1 else None,
                'name': match.player1.username if match.player1 else 'TBD'
            },
            'player2': {
                'id': match.player2.id if match.player2 else None,
                'name': match.player2.username if match.player2 else 'TBD'
            },
            'winner_id': match.winner.id if match.winner else None,
            'status': match.status,
            'score': {
                'player1': match.score_player1,
                'player2': match.score_player2
            }
        }
        
        rounds[round_num].append(match_data)
    
    # Formater les données du tournoi
    tournament_data = {
        'id': str(tournament.id),
        'name': tournament.name,
        'status': tournament.status,
        'current_round': tournament.current_round,
        'winner': tournament.winner.username if tournament.winner else None,
        'rounds': rounds
    }
    
    return tournament_data

def start_tournament_match(match_id):
    """
    Démarre un match de tournoi.
    """
    from .models import TournamentMatch
    
    try:
        match = TournamentMatch.objects.get(id=match_id)
        match.start_match()
        return True
    except (TournamentMatch.DoesNotExist, ValueError) as e:
        return str(e)
    
def record_match_result(match_id, score_player1, score_player2, winner_id=None):
    """
    Enregistre le résultat d'un match de tournoi.
    """
    from .models import TournamentMatch
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    try:
        match = TournamentMatch.objects.get(id=match_id)
        
        # Si un ID de gagnant est spécifié, récupérer l'utilisateur correspondant
        winner = None
        if winner_id:
            winner = User.objects.get(id=winner_id)
        
        match.record_result(score_player1, score_player2, winner)
        return True
    except (TournamentMatch.DoesNotExist, User.DoesNotExist, ValueError) as e:
        return str(e)