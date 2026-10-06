-- New messages are surfaced by the Chat tab's own unread badge and toast, not
-- the notifications list; clear the ones created before that change.
DELETE FROM notifications WHERE type = 'message';
