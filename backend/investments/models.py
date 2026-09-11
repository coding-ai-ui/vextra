from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Investment(models.Model):
    """An editable simulation with a preserved rate; never represents real funds."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="investments")
    project = models.ForeignKey("projects.Project", on_delete=models.PROTECT, related_name="investments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    expected_profit = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    expected_return_snapshot = models.DecimalField(max_digits=5, decimal_places=2, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="investment_positive_amount")]

    @property
    def estimated_total(self):
        return self.amount + self.expected_profit

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.expected_return_snapshot = Decimal(str(self.project.expected_return))
        self.amount = Decimal(str(self.amount))
        self.expected_profit = (
            self.amount * self.expected_return_snapshot / Decimal("100")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if kwargs.get("update_fields") and "amount" in kwargs["update_fields"]:
            kwargs["update_fields"] = {*kwargs["update_fields"], "expected_profit"}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} · {self.project.title} · ${self.amount} simulated"


class PortfolioSnapshot(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolio_history")
    allocated = models.DecimalField(max_digits=18, decimal_places=2)
    value = models.DecimalField(max_digits=18, decimal_places=2)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "id"]
