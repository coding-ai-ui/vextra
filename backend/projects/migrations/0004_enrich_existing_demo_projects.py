from django.db import migrations


def enrich(apps, schema_editor):
    from projects.demo_data import DEMO_METADATA
    Project = apps.get_model("projects", "Project")
    for title, metadata in DEMO_METADATA.items():
        # Only the pre-existing explicitly fictional catalogue receives demo metadata.
        for project in Project.objects.filter(title=title, description__icontains="fictional"):
            values = {name: value for name, value in metadata.items() if not getattr(project, name)}
            Project.objects.filter(pk=project.pk).update(is_demo=True, **values)


class Migration(migrations.Migration):
    dependencies = [("projects", "0003_project_gallery_project_impact_area_and_more")]
    operations = [migrations.RunPython(enrich, migrations.RunPython.noop)]
