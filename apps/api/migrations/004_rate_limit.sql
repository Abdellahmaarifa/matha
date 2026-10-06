-- Shared rate-limit counter storage. The previous in-process dict (see
-- app/common/rate_limit.py) kept a separate counter per gunicorn worker, so
-- the effective limit under `-w 4` was ~4x looser than configured. A small
-- table shared via Postgres fixes that without adding new infra (Redis etc).
CREATE TABLE rate_limit_hits (
    key    TEXT NOT NULL,
    hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limit_hits_key_hit_at ON rate_limit_hits(key, hit_at);
