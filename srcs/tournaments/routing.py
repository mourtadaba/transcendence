# tournaments/routing.py
from django.urls import re_path
from . import consumers
from .consumers import TournamentConsumer

websocket_urlpatterns = [
    re_path(r'ws/tournament/$', consumers.TournamentConsumer.as_asgi()),
]