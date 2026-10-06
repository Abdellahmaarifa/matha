-- Bonus: schedule/organize real-life dates between matched users.
CREATE TABLE dates (
    id             BIGSERIAL PRIMARY KEY,
    proposer_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(120) NOT NULL,
    location_label VARCHAR(120) NOT NULL,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    scheduled_at   TIMESTAMPTZ NOT NULL,
    note           VARCHAR(500) NOT NULL DEFAULT '',
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (proposer_id <> recipient_id),
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'))
);
CREATE INDEX idx_dates_recipient ON dates(recipient_id, scheduled_at);
CREATE INDEX idx_dates_proposer ON dates(proposer_id, scheduled_at);
