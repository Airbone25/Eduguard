"""Optional raw completion count; existing unknown values remain NULL."""

import sqlalchemy as sa

from alembic import op

revision = "0007_completion"
down_revision = "0006_interventions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("weekly_records", sa.Column("assignments_completed", sa.Integer(), nullable=True))
    for name, expression in (
        ("assignments_completed_range", "assignments_completed BETWEEN 0 AND 1000000"),
        ("completed_counts", "assignments_completed <= assignment_count"),
        ("late_completed_counts", "late_submissions <= assignments_completed"),
    ):
        op.create_check_constraint(op.f(f"ck_weekly_records_{name}"), "weekly_records", expression)


def downgrade() -> None:
    for name in ("assignments_completed_range", "completed_counts", "late_completed_counts"):
        op.drop_constraint(op.f(f"ck_weekly_records_{name}"), "weekly_records", type_="check")
    op.drop_column("weekly_records", "assignments_completed")
