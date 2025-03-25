from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Tournament(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open for Registration'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='created_tournaments', on_delete=models.CASCADE)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='tournaments')
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    winner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='tournament_wins', null=True, blank=True, on_delete=models.SET_NULL)
    current_round = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return self.name
    
    def start_tournament(self):
        """Démarre le tournoi et génère les matchs du premier tour"""
        from .services import generate_tournament_matches
        
        if self.status != 'open':
            raise ValueError("Le tournoi ne peut pas être démarré car il n'est pas ouvert aux inscriptions")
        
        if self.participants.count() < 2:
            raise ValueError("Le tournoi doit avoir au moins 2 participants pour démarrer")
        
        self.status = 'in_progress'
        self.start_time = timezone.now()
        self.current_round = 1
        self.save()
        
        # Génère les matchs du premier tour
        generate_tournament_matches(self)
        
        return True
    
    def advance_to_next_round(self):
        """Avance le tournoi au tour suivant avec une meilleure gestion des cas particuliers"""
        from .services import generate_next_round_matches
        
        if self.status != 'in_progress':
            raise ValueError("Le tournoi n'est pas en cours")
        
        # Vérifier si tous les matchs du tour actuel sont terminés
        current_matches = self.matches.filter(round=self.current_round)
        if current_matches.filter(status__in=['pending', 'in_progress']).exists():
            raise ValueError("Tous les matchs du tour actuel doivent être terminés")
        
        # Récupérer les gagnants du tour actuel
        winners = []
        for match in current_matches:
            if match.winner:
                winners.append(match.winner)
            else:
                # Gérer le cas où un match est terminé mais n'a pas de gagnant (ex: égalité)
                raise ValueError(f"Le match {match} est terminé mais n'a pas de gagnant")
        
        # Vérifier si nous avons des gagnants
        if not winners:
            raise ValueError("Aucun gagnant trouvé pour ce tour")
        
        # Si un seul gagnant reste, le tournoi est terminé
        if len(winners) == 1:
            self.status = 'completed'
            self.winner = winners[0]
            self.end_time = timezone.now()
            self.save()
            return True
        
        # Passer au tour suivant
        self.current_round += 1
        self.save()
        
        # Générer les matchs du prochain tour
        generate_next_round_matches(self, winners)
        
        return True
    
    def get_current_matches(self):
        """Récupère les matchs du tour actuel"""
        return self.matches.filter(round=self.current_round)
    
    def notify_current_players(self):
        """Notifie les joueurs du tour actuel"""
        current_matches = self.get_current_matches()
        for match in current_matches:
            if match.status == 'pending':
                match.notify_players()


class TournamentMatch(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('forfeit', 'Forfeit')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tournament = models.ForeignKey(Tournament, related_name='matches', on_delete=models.CASCADE)
    player1 = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='tournament_matches_as_player1', on_delete=models.CASCADE, null=True, blank=True)
    player2 = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='tournament_matches_as_player2', on_delete=models.CASCADE, null=True, blank=True)
    winner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='tournament_match_wins', null=True, blank=True, on_delete=models.SET_NULL)
    round = models.PositiveIntegerField()
    match_order = models.PositiveIntegerField()  # Ordre du match dans le tour
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    score_player1 = models.PositiveIntegerField(default=0)
    score_player2 = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['round', 'match_order']
    
    def __str__(self):
        player1_name = self.player1.username if self.player1 else "TBD"
        player2_name = self.player2.username if self.player2 else "TBD"
        return f"{player1_name} vs {player2_name} (Round {self.round})"
    
    def start_match(self):
        """Démarre le match"""
        if self.status != 'pending':
            raise ValueError("Le match ne peut pas être démarré car il n'est pas en attente")
        
        if not self.player1 or not self.player2:
            raise ValueError("Les deux joueurs doivent être définis pour démarrer le match")
        
        self.status = 'in_progress'
        self.start_time = timezone.now()
        self.save()
        
        return True
    
    def record_result(self, score_player1, score_player2, winner=None):
        """Enregistre le résultat du match"""
        if self.status != 'in_progress':
            raise ValueError("Le match doit être en cours pour enregistrer un résultat")
        
        self.score_player1 = score_player1
        self.score_player2 = score_player2
        
        # Déterminer le gagnant si non spécifié
        if winner is None:
            if score_player1 > score_player2:
                self.winner = self.player1
            elif score_player2 > score_player1:
                self.winner = self.player2
            else:
                # Gestion du match nul (si applicable)
                pass
        else:
            self.winner = winner
        
        self.status = 'completed'
        self.end_time = timezone.now()
        self.save()
        
        # Vérifier si tous les matchs du tour sont terminés
        all_matches_completed = not self.tournament.matches.filter(
            round=self.round, 
            status__in=['pending', 'in_progress']
        ).exists()
        
        if all_matches_completed:
            # Tenter de passer au tour suivant
            try:
                self.tournament.advance_to_next_round()
            except ValueError:
                # Gérer le cas où il n'est pas possible de passer au tour suivant
                pass
        
        return True
    
    def notify_players(self):
        """Notifie les joueurs que leur match est prêt"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        if not self.player1 or not self.player2:
            return False
        
        channel_layer = get_channel_layer()
        
        # Notifier le joueur 1
        try:
            async_to_sync(channel_layer.group_send)(
                f"user_{self.player1.id}",
                {
                    "type": "tournament_match_notification",
                    "tournament_id": str(self.tournament.id),
                    "tournament_name": self.tournament.name,
                    "match_id": str(self.id),
                    "opponent_name": self.player2.username,
                    "opponent_id": self.player2.id,
                    "round": self.round,
                    "message": f"Votre match contre {self.player2.username} est prêt !"
                }
            )
        except Exception:
            pass
        
        # Notifier le joueur 2
        try:
            async_to_sync(channel_layer.group_send)(
                f"user_{self.player2.id}",
                {
                    "type": "tournament_match_notification",
                    "tournament_id": str(self.tournament.id),
                    "tournament_name": self.tournament.name,
                    "match_id": str(self.id),
                    "opponent_name": self.player1.username,
                    "opponent_id": self.player1.id,
                    "round": self.round,
                    "message": f"Votre match contre {self.player1.username} est prêt !"
                }
            )
        except Exception:
            pass
        
        return True