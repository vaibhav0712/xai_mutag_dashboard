from django.urls import path
from . import views

urlpatterns = [
    path("", views.graph_view, name="graph"),
    path("api/molecules/", views.api_molecules, name="api-molecules"),
    path("api/explain/", views.api_explain, name="api-explain"),
]