from django.urls import path
from . import views

app_name = 'tournaments'

urlpatterns = [
    # API URLs
    path('api/tournaments/', views.tournament_list, name='tournament_list'),
    path('api/tournaments/create/', views.create_tournament, name='create_tournament'),
    path('api/tournaments/<uuid:tournament_id>/', views.get_tournament, name='get_tournament'),
    path('api/tournaments/<uuid:tournament_id>/join/', views.join_tournament, name='join_tournament'),
    path('api/tournaments/<uuid:tournament_id>/leave/', views.leave_tournament, name='leave_tournament'),
    path('api/tournaments/<uuid:tournament_id>/start/', views.start_tournament, name='start_tournament'),
    path('api/matches/<uuid:match_id>/start/', views.start_match, name='start_match'),
    path('api/matches/<uuid:match_id>/score/', views.record_match_score, name='record_match_score'),
]