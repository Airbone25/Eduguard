from alembic import context
from app import models  # noqa: F401
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import create_db_engine

target_metadata = Base.metadata
url = context.config.attributes.get("database_url", get_settings().database_url)

if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    connection = context.config.attributes["connection"]
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        version_table_schema=context.config.attributes.get("version_table_schema"),
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    connectable = create_db_engine(url)
    with connectable.begin() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()
