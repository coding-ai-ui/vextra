from django.urls import path

from .views import InvestmentDetailView, InvestmentListCreateView, PortfolioHistoryView

urlpatterns = [
    path("", InvestmentListCreateView.as_view(), name="investment-list"),
    path("history/", PortfolioHistoryView.as_view()),
    path("<int:pk>/", InvestmentDetailView.as_view()),
]
