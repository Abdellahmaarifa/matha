-- OAuth login was removed; drop its table on databases that already ran 002_oauth.sql.
DROP TABLE IF EXISTS oauth_accounts;
