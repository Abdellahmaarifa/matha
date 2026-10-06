"""Restores the pre-baked seed backup (`matcha_seed.sql`) instead of
generating fresh random data - the fast, deterministic path for evaluation.

Unlike `seed_fake_users.py` (which invents new random profiles every time
it's pointed at an empty DB), this loads a fixed snapshot of 500 profiles
that was generated once and committed to the repo, together with copying the
matching photo pool (`seed/photos/{male,female}`) into UPLOAD_DIR so every
seeded profile's 5 photos actually resolve. No Postgres client binary is
required - the dump is plain `INSERT` statements (`pg_dump --column-inserts
--data-only`), executed directly over psycopg2.

Usage:
    python seed/restore_seed_backup.py [--reset]

--reset truncates users/tags (which cascades to photos, user_tags, likes,
and every table that references them) before loading, so this is safe to
re-run against a DB that already has (older or partial) seed data in it.
"""
import argparse
import os
import shutil
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_PATH = os.path.join(SCRIPT_DIR, "matcha_seed.sql")
PHOTO_POOL_DIR = os.path.join(SCRIPT_DIR, "photos")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(SCRIPT_DIR, "..", "uploads"))


def copy_photos_to_uploads() -> int:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    copied = 0
    for subdir in ("male", "female"):
        src_dir = os.path.join(PHOTO_POOL_DIR, subdir)
        for filename in os.listdir(src_dir):
            src = os.path.join(src_dir, filename)
            dst = os.path.join(UPLOAD_DIR, filename)
            if not os.path.exists(dst):
                shutil.copyfile(src, dst)
                copied += 1
    return copied


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset", action="store_true",
        help="TRUNCATE users/tags (cascades to photos/likes/etc.) before loading the backup",
    )
    args = parser.parse_args()

    if not os.path.exists(BACKUP_PATH):
        print(f"No backup found at {BACKUP_PATH}", file=sys.stderr)
        sys.exit(1)

    dsn = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    if args.reset:
        cur.execute("TRUNCATE TABLE users RESTART IDENTITY CASCADE")
        cur.execute("TRUNCATE TABLE tags RESTART IDENTITY CASCADE")
        conn.commit()
        print("Reset: cleared users, tags, and everything that references them.")

    with open(BACKUP_PATH) as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()

    # pg_dump's data sets search_path to '' for safety; restore it for our own query below.
    cur.execute("SET search_path TO public")
    cur.execute("SELECT count(*) FROM users")
    user_count = cur.fetchone()[0]
    cur.close()
    conn.close()

    copied = copy_photos_to_uploads()
    print(f"Loaded backup: {user_count} users now in DB.")
    print(f"Copied {copied} new photo(s) into {UPLOAD_DIR} (rest already present).")
    print("Done. Demo logins: demo_alice / demo_bob, password: Password123!")


if __name__ == "__main__":
    main()
