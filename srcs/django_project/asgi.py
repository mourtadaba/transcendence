"""
ASGI config for django_project project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

# import os

# from channels.auth import AuthMiddlewareStack
# from channels.routing import ProtocolTypeRouter, URLRouter
# from channels.security.websocket import AllowedHostsOriginValidator

# from django.core.asgi import get_asgi_application

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')

# application = get_asgi_application()

# from chat import routing

# application = ProtocolTypeRouter(
#     {
#         "http": application,
#         "websocket": AllowedHostsOriginValidator(
#             AuthMiddlewareStack(URLRouter(routing.websocket_urlpatterns))
#         ),
#     }
# )

import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import chat.routing
import tournaments.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns +
            tournaments.routing.websocket_urlpatterns
        )
    ),
})