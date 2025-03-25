import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging

logger = logging.getLogger(__name__)

class BaseConsumer(AsyncWebsocketConsumer):
    """Classe de base pour les consommateurs WebSocket"""
    
    async def connect(self):
        # Obtenir l'utilisateur authentifié
        self.user = self.scope['user']
        self.user_id = self.user.id
        
        # Groupe spécifique à l'utilisateur pour les notifications
        self.user_group_name = f'user_{self.user_id}'
        
        # Rejoindre le groupe spécifique à l'utilisateur
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        logger.info(f"WebSocket connecté - User ID: {self.user_id}")
        await self.accept()

    async def disconnect(self, close_code):
        # Quitter le groupe utilisateur
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )
        
        logger.info(f"WebSocket déconnecté - User ID: {self.user_id}, Code: {close_code}")
    
    async def tournament_match_notification(self, event):
        """Envoyer une notification de match de tournoi au WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'tournament_match_notification',
            'tournament_id': event['tournament_id'],
            'tournament_name': event['tournament_name'],
            'match_id': event['match_id'],
            'opponent_name': event['opponent_name'],
            'opponent_id': event['opponent_id'],
            'round': event['round'],
            'message': event['message']
        }))
    
    async def tournament_update(self, event):
        """Envoyer une mise à jour du tournoi au WebSocket"""
        print("Méthode tournament_update de TournamentConsumer appelée")
        await self.send(text_data=json.dumps({
            'type': 'tournament_update',
            'tournament_id': event['tournament_id'],
            'status': event['status'],
            'current_round': event.get('current_round'),
            'message': event['message']
        }))
