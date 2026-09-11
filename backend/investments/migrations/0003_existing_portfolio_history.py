from decimal import Decimal
from django.db import migrations


def backfill(apps, schema_editor):
    Investment = apps.get_model("investments", "Investment")
    Snapshot = apps.get_model("investments", "PortfolioSnapshot")
    for user_id in Investment.objects.values_list("user_id", flat=True).distinct():
        allocated = value = Decimal("0")
        for item in Investment.objects.filter(user_id=user_id).order_by("created_at", "id"):
            allocated += item.amount
            value += item.amount + item.expected_profit
            snapshot = Snapshot.objects.create(user_id=user_id, allocated=allocated, value=value)
            Snapshot.objects.filter(pk=snapshot.pk).update(date=item.created_at)


class Migration(migrations.Migration):
    dependencies = [("investments", "0002_portfoliosnapshot")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
