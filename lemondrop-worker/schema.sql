CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    recipient TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipient ON emails(recipient);
CREATE INDEX IF NOT EXISTS idx_time ON emails(received_at);