"""Persist teacher-selected intervention frequency."""

import sqlalchemy as sa

from alembic import op

revision = "0009_frequency"
down_revision = "0008_imports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interventions", sa.Column("frequency", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("interventions", "frequency")
