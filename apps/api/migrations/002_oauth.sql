-- Links local user accounts to third-party OAuth identities (bonus: OmniAuth-style
-- multi-provider login). A user can have several linked providers; each provider
-- account can only ever be linked to one user.
CREATE TABLE oauth_accounts (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     VARCHAR(20) NOT NULL,
    provider_uid VARCHAR(100) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_uid)
);
CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
