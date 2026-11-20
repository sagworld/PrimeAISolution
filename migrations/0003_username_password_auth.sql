ALTER TABLE users RENAME COLUMN email TO username;
ALTER TABLE users RENAME COLUMN normalized_email TO normalized_username;
ALTER TABLE users ADD COLUMN password_hash TEXT;

ALTER TABLE auth_otp_request_limits RENAME TO auth_login_request_limits;
DROP INDEX idx_otp_challenges_user_created;
DROP TABLE auth_otp_challenges;

CREATE INDEX idx_users_active_username ON users(is_active, normalized_username);
