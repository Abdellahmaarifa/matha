-- Matcha schema (raw SQL, no ORM, per subject constraints)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    email               CITEXT UNIQUE NOT NULL,
    username            CITEXT UNIQUE NOT NULL,
    first_name          VARCHAR(60) NOT NULL,
    last_name           VARCHAR(60) NOT NULL,
    password_hash       TEXT NOT NULL,
    birth_date          DATE NOT NULL,
    gender              VARCHAR(20),
    sexual_pref         VARCHAR(20) NOT NULL DEFAULT 'bisexual',
    biography           TEXT NOT NULL DEFAULT '',
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    location_label      VARCHAR(120),
    location_source     VARCHAR(10) NOT NULL DEFAULT 'manual', -- 'gps' | 'manual'
    fame_rating         INTEGER NOT NULL DEFAULT 0,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token  TEXT,
    verification_expires TIMESTAMPTZ,
    reset_token         TEXT,
    reset_expires       TIMESTAMPTZ,
    is_online           BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE photos (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    position    SMALLINT NOT NULL DEFAULT 0,
    is_profile  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_user ON photos(user_id);

CREATE TABLE tags (
    id      BIGSERIAL PRIMARY KEY,
    name    CITEXT UNIQUE NOT NULL
);

CREATE TABLE user_tags (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE likes (
    id          BIGSERIAL PRIMARY KEY,
    liker_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (liker_id, liked_id),
    CHECK (liker_id <> liked_id)
);
CREATE INDEX idx_likes_liked ON likes(liked_id);
CREATE INDEX idx_likes_liker ON likes(liker_id);

CREATE TABLE blocks (
    id          BIGSERIAL PRIMARY KEY,
    blocker_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE TABLE reports (
    id           BIGSERIAL PRIMARY KEY,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       VARCHAR(30) NOT NULL DEFAULT 'fake_account',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reporter_id, reported_id)
);

CREATE TABLE visits (
    id           BIGSERIAL PRIMARY KEY,
    visitor_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visited_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (visitor_id <> visited_id)
);
CREATE INDEX idx_visits_visited ON visits(visited_id, created_at DESC);
CREATE INDEX idx_visits_visitor ON visits(visitor_id, created_at DESC);

CREATE TABLE messages (
    id            BIGSERIAL PRIMARY KEY,
    sender_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body          VARCHAR(2000) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at       TIMESTAMPTZ,
    CHECK (sender_id <> recipient_id)
);
CREATE INDEX idx_messages_pair ON messages(LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at);

CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL, -- like|unlike|view|message|match
    actor_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
