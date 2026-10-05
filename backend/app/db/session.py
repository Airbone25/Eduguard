import re
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def create_db_engine(url: str, schema: str = "public") -> Engine:
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema):
        raise ValueError("Invalid database schema")
    engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})

    @event.listens_for(engine, "begin")
    def set_transaction_schema(connection) -> None:
        # Transaction-local state works with PgBouncer/Neon transaction pooling.
        # Session-level SET can leak or disappear when the server connection changes.
        connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}", public')

    return engine


engine = create_db_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Generator[Session]:
    with SessionLocal() as session:
        yield session
