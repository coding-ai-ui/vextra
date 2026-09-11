from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify


class Project(models.Model):
    RISK_LEVELS = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, blank=True, unique=True)
    short_description = models.CharField(max_length=260, blank=True)
    description = models.TextField()
    objective = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    category = models.CharField(max_length=100)
    organization = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=[("draft", "Draft"), ("active", "Active"), ("completed", "Completed")], default="active")
    impact_area = models.CharField(max_length=100, blank=True)
    impact_score = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)])
    tags = models.JSONField(default=list, blank=True)
    gallery = models.JSONField(default=list, blank=True)
    sustainability = models.JSONField(default=list, blank=True)
    is_demo = models.BooleanField(default=False)

    funding_goal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    current_funding = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    expected_return = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )

    duration = models.PositiveIntegerField(
        help_text="Duration in months",
        validators=[MinValueValidator(1), MaxValueValidator(120)],
    )

    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVELS,
        default="Medium"
    )

    image = models.URLField(
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )
    updated_at = models.DateTimeField(auto_now=True)
    featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["-featured", "-created_at", "id"]

    @property
    def funding_percentage(self):
        if self.funding_goal <= 0:
            return Decimal("0.0")
        return min(Decimal("100"), max(Decimal("0"), (
            self.current_funding / self.funding_goal * Decimal("100")
        ))).quantize(Decimal("0.1"))

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or "project"
            self.slug = base
            suffix = 2
            while type(self).objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f"{base}-{suffix}"
                suffix += 1
        if not self.short_description:
            self.short_description = self.description[:257] + ("..." if len(self.description) > 257 else "")
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
