# tournaments/consumers.py
from core.consumers import BaseConsumer
import json

class TournamentConsumer(BaseConsumer):
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'tournament_update':
            # Transmettre au gestionnaire de la classe parente
            await self.tournament_update(data)
        elif message_type == 'tournament_action':
            action = data.get('action')
            
            if action == 'join_tournament':
                tournament_id = data.get('tournament_id')
                # Traitement rejoindre tournoi
                pass
            elif action == 'start_match':
                match_id = data.get('match_id')
                # Traitement démarrer match