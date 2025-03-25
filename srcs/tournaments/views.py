from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib import messages
from django.db import transaction
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

import json

from .models import Tournament, TournamentMatch
from .services import get_tournament_bracket, start_tournament_match, record_match_result



@login_required
def tournament_list(request):
    """Vue pour afficher la liste des tournois"""
    tournaments = Tournament.objects.select_related('created_by', 'winner').prefetch_related('participants').all().order_by('-created_at')
    
    return JsonResponse({
        'tournaments': [{
            'id': str(tournament.id),
            'name': tournament.name,
            'status': tournament.status,
            'participants_count': tournament.participants.count(),
            'created_by': tournament.created_by.username,
            'created_at': tournament.created_at.isoformat(),
            'is_creator': tournament.created_by == request.user,
            'is_participant': tournament.participants.filter(id=request.user.id).exists()
        } for tournament in tournaments]
    })

@login_required
@require_http_methods(["POST"])
def create_tournament(request):
    """Vue pour créer un nouveau tournoi"""
    try:
        data = json.loads(request.body)
        name = data.get('name')

        if not name:
            return JsonResponse({'status': 'error', 'message': 'Le nom du tournoi est requis'}, status=400)

        # Vérifier si un tournoi avec ce nom existe déjà
        if Tournament.objects.filter(name=name).exists():
            return JsonResponse({'status': 'error', 'message': 'Un tournoi avec ce nom existe déjà'}, status=400)

        # Création du tournoi
        tournament = Tournament.objects.create(
            name=name,
            created_by=request.user,
            status='open'
        )

        # Ajouter le créateur comme participant
        tournament.participants.add(request.user)

        return JsonResponse({
            'status': 'success',
            'tournament': {
                'id': str(tournament.id),
                'name': tournament.name,
                'status': tournament.status,
                'participants_count': 1,
                'created_by': request.user.username,
                'created_at': tournament.created_at.isoformat()
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
def get_tournament(request, tournament_id):
    """Vue pour obtenir les détails d'un tournoi"""
    try:
        tournament_data = get_tournament_bracket(tournament_id)
        
        if not tournament_data:
            return JsonResponse({'status': 'error', 'message': 'Tournoi non trouvé'}, status=404)
        
        # Ajouter des informations supplémentaires
        tournament = Tournament.objects.get(id=tournament_id)
        tournament_data['participants'] = [{
            'id': participant.id,
            'username': participant.username
        } for participant in tournament.participants.all()]
        
        tournament_data['is_creator'] = tournament.created_by == request.user
        tournament_data['is_participant'] = tournament.participants.filter(id=request.user.id).exists()
        tournament_data['created_by'] = tournament.created_by.username
        tournament_data['created_at'] = tournament.created_at.isoformat()
        
        return JsonResponse({'status': 'success', 'tournament': tournament_data})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
def join_tournament(request, tournament_id):
    """Vue pour rejoindre un tournoi"""
    try:
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        if tournament.status != 'open':
            return JsonResponse({
                'status': 'error',
                'message': 'Ce tournoi n\'accepte plus de nouveaux participants'
            }, status=400)
        
        # Vérifier si l'utilisateur est déjà participant
        if tournament.participants.filter(id=request.user.id).exists():
            return JsonResponse({
                'status': 'error',
                'message': 'Vous êtes déjà inscrit à ce tournoi'
            }, status=400)
        
        # Ajouter l'utilisateur comme participant
        tournament.participants.add(request.user)
        
        # Notifier les autres participants
        channel_layer = get_channel_layer()
        for participant in tournament.participants.all():
            if participant != request.user:
                try:
                    async_to_sync(channel_layer.group_send)(
                        f"user_{participant.id}",
                        {
                            "type": "tournament_update",
                            "tournament_id": str(tournament.id),
                            "status": tournament.status,
                            "message": f"{request.user.username} a rejoint le tournoi {tournament.name}"
                        }
                    )
                except Exception:
                    pass
        
        return JsonResponse({
            'status': 'success',
            'message': f'Vous avez rejoint le tournoi {tournament.name}',
            'participants_count': tournament.participants.count()
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
def leave_tournament(request, tournament_id):
    """Vue pour quitter un tournoi"""
    try:
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        if tournament.status != 'open':
            return JsonResponse({
                'status': 'error',
                'message': 'Vous ne pouvez pas quitter un tournoi qui a déjà commencé'
            }, status=400)
        
        # Vérifier si l'utilisateur est participant
        if not tournament.participants.filter(id=request.user.id).exists():
            return JsonResponse({
                'status': 'error',
                'message': 'Vous n\'êtes pas inscrit à ce tournoi'
            }, status=400)
        
        # Ajouter des logs de débogage
        print(f"Utilisateur {request.user.username} tente de quitter le tournoi {tournament.name}")
        print(f"Status du tournoi: {tournament.status}")
        print(f"L'utilisateur est le créateur: {tournament.created_by == request.user}")
        print(f"Nombre de participants: {tournament.participants.count()}")
        
        # Empêcher le créateur de quitter si d'autres joueurs sont encore inscrits
        if tournament.created_by == request.user and tournament.participants.count() > 1:
            return JsonResponse({
                'status': 'error',
                'message': 'Le créateur ne peut pas quitter un tournoi tant qu\'il reste des participants'
            }, status=400)
        
        # Retirer l'utilisateur des participants
        tournament.participants.remove(request.user)
        
        # Supprimer le tournoi si le créateur part et qu'il n'y a plus de participants
        if tournament.created_by == request.user and tournament.participants.count() == 0:
            tournament.delete()
            return JsonResponse({
                'status': 'success',
                'message': f'Le tournoi {tournament.name} a été supprimé car il n\'avait plus de participants'
            })

        
        # Notifier les autres participants
        channel_layer = get_channel_layer()
        for participant in tournament.participants.all():
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{participant.id}",
                    {
                        "type": "tournament_update",
                        "tournament_id": str(tournament.id),
                        "status": tournament.status,
                        "message": f"{request.user.username} a quitté le tournoi {tournament.name}"
                    }
                )
            except Exception:
                pass
        
        return JsonResponse({
            'status': 'success',
            'message': f'Vous avez quitté le tournoi {tournament.name}',
            'participants_count': tournament.participants.count()
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def start_tournament(request, tournament_id):
    """Vue pour démarrer un tournoi"""
    try:
        print(f"Tentative de démarrage du tournoi {tournament_id}")
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        # Vérifier si l'utilisateur est le créateur du tournoi
        if tournament.created_by != request.user:
            print(f"Erreur: l'utilisateur {request.user.username} n'est pas le créateur du tournoi")
            return JsonResponse({
                'status': 'error',
                'message': 'Seul le créateur du tournoi peut le démarrer'
            }, status=403)
        
        
        if tournament.status != 'open':
            print(f"Erreur: le tournoi n'est pas ouvert, status={tournament.status}")
            return JsonResponse({
                'status': 'error',
                'message': 'Ce tournoi ne peut pas être démarré car il n\'est pas ouvert aux inscriptions'
            }, status=400)
        
        participant_count = tournament.participants.count()
        print(f"Nombre de participants: {participant_count}")
        
        if participant_count < 2:
            print("Erreur: moins de 2 participants")
            return JsonResponse({
                'status': 'error',
                'message': 'Le tournoi doit avoir au moins 2 participants pour démarrer'
            }, status=400)
        
        # Démarrer le tournoi
        print("Démarrage du tournoi...")
        tournament.start_tournament()
        
        # Notifier tous les participants
        channel_layer = get_channel_layer()
        print(f"Envoi de notifications à {participant_count} participants")
        
        for participant in tournament.participants.all():
            try:
                print(f"Envoi à {participant.username}")
                async_to_sync(channel_layer.group_send)(
                    f"user_{participant.id}",
                    {
                        "type": "tournament_update",
                        "tournament_id": str(tournament.id),
                        "status": tournament.status,
                        "current_round": tournament.current_round,
                        "message": f"Le tournoi {tournament.name} a commencé !"
                    }
                )
                print(f"Notification envoyée à {participant.username}")
            except Exception as e:
                print(f"ERREUR: Impossible d'envoyer la notification à {participant.username}: {str(e)}")
        
        # Notifier les joueurs des matchs du premier tour
        print("Notification des joueurs pour les matchs du premier tour")
        current_matches = tournament.get_current_matches()
        print(f"Nombre de matchs: {current_matches.count()}")
        
        for match in current_matches:
            try:
                print(f"Notification du match: {match}")
                match.notify_players()
                print("Notification du match envoyée")
            except Exception as e:
                print(f"ERREUR: Impossible d'envoyer la notification pour le match: {str(e)}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'Le tournoi {tournament.name} a démarré',
            'tournament': get_tournament_bracket(tournament_id)
        })
    except ValueError as e:
        print(f"ValueError: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    except Exception as e:
        print(f"Exception: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    

@login_required
@require_http_methods(["POST"])
def start_match(request, match_id):
    """Vue pour démarrer un match de tournoi"""
    try:
        print(f"Tentative de démarrage du match {match_id} par {request.user.username}")
        match = get_object_or_404(TournamentMatch, id=match_id)
        # Vérifier l'état actuel du match
        print(f"État actuel du match: {match.status}")
        print(f"Joueur 1: {match.player1.username}, Joueur 2: {match.player2.username}")
        
        # Vérifier si l'utilisateur est l'un des joueurs du match
        is_player = (request.user == match.player1 or request.user == match.player2)
        print(f"L'utilisateur est-il un joueur du match? {is_player}")
        if not is_player:
            print(f"Erreur: {request.user.username} n'est pas autorisé à démarrer ce match")
            return JsonResponse({
                'status': 'error',
                'message': 'Vous n\'êtes pas autorisé à démarrer ce match'
            }, status=403)
        
        # Essayer de démarrer le match
        try:
            result = start_tournament_match(match_id)
            print(f"Résultat du démarrage: {result}")
        except Exception as e:
            print(f"Erreur lors du démarrage du match: {str(e)}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
        
        if result is True:
            # Notifier l'autre joueur
            other_player = match.player2 if request.user == match.player1 else match.player1
            
            channel_layer = get_channel_layer()
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{other_player.id}",
                    {
                        "type": "tournament_match_notification",
                        "tournament_id": str(match.tournament.id),
                        "tournament_name": match.tournament.name,
                        "match_id": str(match.id),
                        "opponent_name": request.user.username,
                        "opponent_id": request.user.id,
                        "round": match.round,
                        "message": f"{request.user.username} a démarré votre match !"
                    }
                )
            except Exception:
                pass
            
            print("Match démarré avec succès")
            return JsonResponse({
                'status': 'success',
                'message': 'Le match a démarré',
                'redirect_url': f'/#/pong?matchId={match.id}&player1={match.player1.id}&player2={match.player2.id}&tournamentId={match.tournament.id}'            })
        else:
            print(f"Erreur de démarrage du match: {result}")
            return JsonResponse({'status': 'error', 'message': result}, status=400)
    except Exception as e:
        print(f"Exception non gérée: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
def record_match_score(request, match_id):
    """Vue pour enregistrer le score d'un match de tournoi"""
    try:
        data = json.loads(request.body)
        score_player1 = int(data.get('score_player1', 0))
        score_player2 = int(data.get('score_player2', 0))
        
        match = get_object_or_404(TournamentMatch, id=match_id)
        
        # Vérifier si l'utilisateur est l'un des joueurs ou le créateur du tournoi
        if (request.user != match.player1 and 
            request.user != match.player2 and 
            request.user != match.tournament.created_by):
            return JsonResponse({
                'status': 'error',
                'message': 'Vous n\'êtes pas autorisé à enregistrer ce score'
            }, status=403)
        
        # Déterminer le gagnant en fonction des scores
        winner_id = None
        if score_player1 > score_player2:
            winner_id = match.player1.id
        elif score_player2 > score_player1:
            winner_id = match.player2.id
        
        result = record_match_result(match_id, score_player1, score_player2, winner_id)
        
        if result is True:
            # Notifier les deux joueurs
            channel_layer = get_channel_layer()
            
            # Notifier le joueur 1
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{match.player1.id}",
                    {
                        "type": "tournament_update",
                        "tournament_id": str(match.tournament.id),
                        "status": "match_completed",
                        "message": f"Votre match contre {match.player2.username} est terminé. Score: {score_player1}-{score_player2}"
                    }
                )
            except Exception:
                pass
            
            # Notifier le joueur 2
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{match.player2.id}",
                    {
                        "type": "tournament_update",
                        "tournament_id": str(match.tournament.id),
                        "status": "match_completed",
                        "message": f"Votre match contre {match.player1.username} est terminé. Score: {score_player2}-{score_player1}"
                    }
                )
            except Exception:
                pass
            
            # Si le tournoi a avancé au tour suivant, notifier les joueurs des nouveaux matchs
            if match.tournament.current_round > match.round:
                for current_match in match.tournament.get_current_matches():
                    current_match.notify_players()
            
            return JsonResponse({
                'status': 'success',
                'message': 'Score enregistré avec succès',
                'tournament_data': get_tournament_bracket(str(match.tournament.id))
            })
        else:
            return JsonResponse({'status': 'error', 'message': result}, status=400)
    except ValueError as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)