-- Migration number: 0002 	 2026-09-01T10:45:00.000Z

CREATE TABLE mcqs (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by);
CREATE INDEX idx_mcqs_updated_at ON mcqs (updated_at);

CREATE TABLE choices (
  id TEXT PRIMARY KEY,
  mcq_id TEXT NOT NULL,
  body TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_choices_mcq_id ON choices (mcq_id);
CREATE UNIQUE INDEX idx_choices_mcq_id_position ON choices (mcq_id, position);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_attempts_user_id ON attempts (user_id);
CREATE INDEX idx_attempts_mcq_id ON attempts (mcq_id);
CREATE INDEX idx_attempts_user_mcq ON attempts (user_id, mcq_id);
