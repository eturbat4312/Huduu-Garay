from django.db import migrations, models
from django.db.models.functions import Lower, Trim


def normalize_unique_emails(apps, schema_editor):
    users = apps.get_model("core", "CustomUser").objects.using(schema_editor.connection.alias)
    duplicates = (
        users.annotate(normalized_email=Lower(Trim("email")))
        .exclude(normalized_email="")
        .values("normalized_email")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)
    )
    if duplicates.exists():
        raise RuntimeError(
            "Duplicate user emails found. Review and resolve existing accounts before "
            "applying core.0052_unique_user_email; no accounts have been merged or deleted."
        )
    users.update(email=Lower(Trim("email")))


class Migration(migrations.Migration):
    dependencies = [("core", "0051_platformanalyticsevent")]
    operations = [
        migrations.RunPython(normalize_unique_emails, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="customuser",
            constraint=models.UniqueConstraint(
                Lower(Trim("email")),
                condition=~models.Q(email=""),
                name="unique_user_email_case_insensitive",
            ),
        ),
    ]
