"""Seeds the database with >= 500 profiles, as required for evaluation.

Standalone script: talks to Postgres directly with psycopg2, does not import
the Flask app (no request/app-context needed), so it can run as a one-off
`python seed/seed_fake_users.py` before the API is even started.

Profile photos come from a small, gender-sorted pool of real CelebA-HQ
portraits shipped in `seed/photos/{male,female}` (see
`prepare_seed_photos.py` for how that pool was built) - every profile gets 5
of them instead of the old generated placeholder avatars.
"""
import os
import random
import shutil
import sys
import uuid

import bcrypt
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from faker import Faker

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TARGET_USER_COUNT = 500
PHOTOS_PER_USER = 5
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
PHOTO_POOL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photos")

CITIES = [
    ("New York", 40.7128, -74.0060),
    ("London", 51.5074, -0.1278),
    ("Toronto", 43.6532, -79.3832),
    ("Sydney", -33.8688, 151.2093),
    ("Manchester", 53.4808, -2.2426),
    ("Dublin", 53.3498, -6.2603),
    ("Austin", 30.2672, -97.7431),
    ("Chicago", 41.8781, -87.6298),
]

TAG_POOL = [
    "vegan", "geek", "piercing", "hiking", "cinema", "gaming", "yoga", "foodie",
    "travel", "music", "art", "photography", "reading", "coffee", "cats", "dogs",
    "running", "climbing", "surfing", "cooking", "dancing", "startup", "crypto",
    "vinyl", "boardgames", "anime", "cycling", "wine", "tattoos", "minimalism",
]

GENDERS = ["man", "woman", "other"]
ORIENTATIONS = ["heterosexual", "homosexual", "bisexual"]

fake = Faker("en_US")
Faker.seed(42)
random.seed(42)


def load_photo_pool() -> tuple[list[str], list[str]]:
    """Returns (male_filenames, female_filenames) from the shipped photo pool."""
    male_dir = os.path.join(PHOTO_POOL_DIR, "male")
    female_dir = os.path.join(PHOTO_POOL_DIR, "female")
    male = sorted(os.listdir(male_dir))
    female = sorted(os.listdir(female_dir))
    if not male or not female:
        raise RuntimeError(
            f"Seed photo pool is empty ({PHOTO_POOL_DIR}). "
            "Run prepare_seed_photos.py against a CelebA-HQ dataset checkout first."
        )
    return male, female


def copy_photo_pool_to_uploads(male: list[str], female: list[str]) -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    for subdir, filenames in (("male", male), ("female", female)):
        src_dir = os.path.join(PHOTO_POOL_DIR, subdir)
        for filename in filenames:
            src = os.path.join(src_dir, filename)
            dst = os.path.join(UPLOAD_DIR, filename)
            if not os.path.exists(dst):
                shutil.copyfile(src, dst)


def pick_photos_for_gender(gender: str, male: list[str], female: list[str]) -> list[str]:
    if gender == "man":
        pool = male
    elif gender == "woman":
        pool = female
    else:
        pool = male + female
    return random.sample(pool, min(PHOTOS_PER_USER, len(pool)))


def make_password_hash(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def main():
    dsn = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    male_photos, female_photos = load_photo_pool()
    copy_photo_pool_to_uploads(male_photos, female_photos)

    cur.execute("SELECT count(*) AS n FROM users")
    existing = cur.fetchone()["n"]
    if existing >= TARGET_USER_COUNT:
        print(f"Already have {existing} users, skipping.")
        return

    tag_ids = {}
    for name in TAG_POOL:
        cur.execute(
            "INSERT INTO tags (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name "
            "RETURNING id",
            (name,),
        )
        tag_ids[name] = cur.fetchone()["id"]
    conn.commit()

    demo_password = make_password_hash("Password123!")
    created_ids = []

    demo_accounts = [
        ("demo1@matcha.local", "demo_alice", "Alice", "Demo", "woman", "bisexual"),
        ("demo2@matcha.local", "demo_bob", "Bob", "Demo", "man", "bisexual"),
    ]
    city = CITIES[0]
    for email, username, first, last, gender, pref in demo_accounts:
        cur.execute(
            """
            INSERT INTO users (email, username, first_name, last_name, birth_date, password_hash,
                                gender, sexual_pref, biography, latitude, longitude, location_label,
                                location_source, is_verified, fame_rating)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'manual', TRUE, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id
            """,
            (email, username, first, last, "1996-05-10", demo_password, gender, pref,
             "Seed demo account for manual testing.", city[1], city[2], city[0], random.randint(40, 80)),
        )
        row = cur.fetchone()
        if row:
            created_ids.append(row["id"])
    conn.commit()

    batch = []
    for i in range(TARGET_USER_COUNT - len(demo_accounts)):
        gender = random.choice(GENDERS)
        pref = random.choices(ORIENTATIONS, weights=[55, 15, 30])[0]
        first = fake.first_name_male() if gender == "man" else fake.first_name_female() if gender == "woman" else fake.first_name()
        last = fake.last_name()
        username = f"{first.lower()}{last.lower()}{i}"[:20]
        email = f"seed{i}_{uuid.uuid4().hex[:8]}@matcha.local"
        birth_date = fake.date_of_birth(minimum_age=18, maximum_age=55)
        city = random.choice(CITIES)
        jitter = lambda: random.uniform(-0.08, 0.08)
        lat, lng = city[1] + jitter(), city[2] + jitter()
        bio = fake.sentence(nb_words=16)
        fame = int(random.betavariate(2, 5) * 100)

        batch.append((
            email, username, first, last, birth_date, demo_password, gender, pref, bio,
            lat, lng, city[0], True, fame,
        ))

    psycopg2.extras.execute_batch(
        cur,
        """
        INSERT INTO users (email, username, first_name, last_name, birth_date, password_hash,
                            gender, sexual_pref, biography, latitude, longitude, location_label,
                            is_verified, fame_rating)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (email) DO NOTHING
        """,
        batch,
        page_size=200,
    )
    conn.commit()

    cur.execute("SELECT id, gender FROM users ORDER BY id")
    users = cur.fetchall()
    all_ids = [r["id"] for r in users]
    print(f"Total users in DB: {len(all_ids)}")

    for user in users:
        uid = user["id"]
        num_tags = random.randint(2, 6)
        for name in random.sample(TAG_POOL, num_tags):
            cur.execute(
                "INSERT INTO user_tags (user_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (uid, tag_ids[name]),
            )
        photos = pick_photos_for_gender(user["gender"], male_photos, female_photos)
        for pos, filename in enumerate(photos):
            cur.execute(
                "INSERT INTO photos (user_id, filename, position, is_profile) VALUES (%s, %s, %s, %s)",
                (uid, filename, pos, pos == 0),
            )
    conn.commit()
    print("Tags and photos assigned.")

    like_pairs = set()
    for _ in range(int(len(all_ids) * 1.5)):
        a, b = random.sample(all_ids, 2)
        like_pairs.add((a, b))
    for a, b in like_pairs:
        cur.execute(
            "INSERT INTO likes (liker_id, liked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (a, b),
        )
    conn.commit()
    print(f"Seeded {len(like_pairs)} likes.")

    cur.close()
    conn.close()
    print("Done. Demo logins: demo_alice / demo_bob, password: Password123!")


if __name__ == "__main__":
    main()
