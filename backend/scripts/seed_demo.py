from app.core.config import get_settings
from app.db.seed import seed_demo
from app.db.session import SessionLocal


def main() -> None:
    if get_settings().environment != "development":
        raise SystemExit("Demo seeding is allowed only in development.")
    with SessionLocal.begin() as db:
        school = seed_demo(db)
        print(f"Demo school ready: {school.slug} ({school.id}). See README for demo credentials.")


if __name__ == "__main__":
    main()
