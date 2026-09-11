from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings


def api_test(request):
    return JsonResponse({
        "success": True,
        "message": "Vestra API is working. For educational demonstration only."
    })


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/test/", api_test),
    path("api/users/", include("users.urls")),
    path("api/investments/", include("investments.urls")),
    path("api/community/", include("community.urls")),
    path("api/config/", lambda request: JsonResponse({"demo_mode": settings.DEMO_MODE, "simulation_only": True})),

    path(
        "api/projects/",
        include("projects.urls")
    ),
]

admin.site.site_header = "Vestra · Simulation administration"
admin.site.site_title = "Vestra Admin"
admin.site.index_title = "Projects and simulated portfolios"
