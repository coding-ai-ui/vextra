from decimal import Decimal
from django.db import transaction
from django.db.models import Prefetch, Sum
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .models import Investment, PortfolioSnapshot
from .serializers import InvestmentSerializer
from community.services import activity


def record_snapshot(user):
    totals = Investment.objects.filter(user=user).aggregate(allocated=Sum("amount"), profit=Sum("expected_profit"))
    allocated = totals["allocated"] or Decimal("0")
    return PortfolioSnapshot.objects.create(user=user, allocated=allocated, value=allocated + (totals["profit"] or Decimal("0")))


def portfolio_queryset(user):
    from projects.views import project_queryset
    return Investment.objects.filter(user=user).prefetch_related(Prefetch("project", queryset=project_queryset(user, include_drafts=True)))


class InvestmentListCreateView(generics.ListCreateAPIView):
    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return portfolio_queryset(self.request.user)

    @transaction.atomic
    def perform_create(self, serializer):
        if not self.request.user.portfolio_history.exists():
            record_snapshot(self.request.user)
        investment = serializer.save(user=self.request.user)
        activity(self.request.user, "simulated", f"You added {investment.project.title} to your simulated portfolio", f"/portfolio")
        record_snapshot(self.request.user)


class InvestmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete", "options"]

    def get_queryset(self):
        return portfolio_queryset(self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        investment = serializer.save()
        activity(self.request.user, "allocation_updated", f"You updated your simulated allocation to {investment.project.title}", "/portfolio")
        record_snapshot(self.request.user)

    @transaction.atomic
    def perform_destroy(self, instance):
        activity(self.request.user, "allocation_removed", f"You removed {instance.project.title} from your simulated portfolio", "/portfolio")
        instance.delete()
        record_snapshot(self.request.user)


class PortfolioSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioSnapshot
        fields = ["date", "allocated", "value"]


class PortfolioHistoryView(generics.ListAPIView):
    serializer_class = PortfolioSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PortfolioSnapshot.objects.filter(user=self.request.user)
