"""Tiny hand-rolled migration runner (no ORM / migration framework by design)."""
import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")


def main():
    dsn = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())"
            )
            conn.commit()
            cur.execute("SELECT filename FROM schema_migrations")
            applied = {row[0] for row in cur.fetchall()}

        for filename in sorted(os.listdir(MIGRATIONS_DIR)):
            if not filename.endswith(".sql") or filename in applied:
                continue
            path = os.path.join(MIGRATIONS_DIR, filename)
            print(f"Applying {filename}...")
            with open(path) as f, conn.cursor() as cur:
                cur.execute(f.read())
                cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (filename,))
            conn.commit()
        print("Migrations up to date.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
