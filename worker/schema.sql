-- D1 schema for mydogcanfly-api
-- Apply with: wrangler d1 execute mydogcanfly --file=./schema.sql

CREATE TABLE IF NOT EXISTS subscribers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,               -- 'plan' | 'heat'
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'unsubscribed'
  token         TEXT NOT NULL UNIQUE,         -- confirm + unsubscribe
  -- heat subscribers
  lat           REAL,
  lon           REAL,
  place         TEXT,
  threshold     TEXT,                         -- optional per-user override (level 1..4)
  -- plan subscribers
  pet           TEXT,
  origin        TEXT,
  destination   TEXT,
  travel_date   TEXT,                         -- ISO yyyy-mm-dd
  -- housekeeping
  created_at    TEXT NOT NULL,
  confirmed_at  TEXT,
  last_alert_at TEXT,                         -- ISO date of last heat alert (anti-spam)
  unsub_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sub_type_status ON subscribers(type, status);
CREATE INDEX IF NOT EXISTS idx_sub_token ON subscribers(token);

-- Dated reminder steps for 'plan' subscribers
CREATE TABLE IF NOT EXISTS plan_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL,
  step_key      TEXT NOT NULL,                -- 'microchip_vaccine' | 'titer' | 'certificate' ...
  label         TEXT NOT NULL,               -- human text used in the email
  due_date      TEXT NOT NULL,               -- ISO yyyy-mm-dd when to send the reminder
  sent_at       TEXT,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
);

CREATE INDEX IF NOT EXISTS idx_steps_due ON plan_steps(due_date, sent_at);
