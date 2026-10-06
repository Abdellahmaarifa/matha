-- Guard against two rows both being the profile picture for the same user.
-- The application now also serializes the count-check-and-insert (save_photo)
-- and the clear-then-set pair (set_profile_photo) with a row lock, but this
-- index is the actual data-integrity backstop.
CREATE UNIQUE INDEX idx_photos_one_profile_per_user ON photos(user_id) WHERE is_profile;
