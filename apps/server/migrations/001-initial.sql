CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS auth_sessions(
  token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON auth_sessions(account_id);
CREATE TABLE IF NOT EXISTS clubs(
  id uuid PRIMARY KEY, account_id uuid NOT NULL UNIQUE REFERENCES accounts(id), name text NOT NULL,
  runtime jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS athletes(
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id),
  rarity text NOT NULL CHECK(rarity IN ('P1','P2','P3','P4','P5')),
  xp_total numeric NOT NULL CHECK(xp_total>=0 AND xp_total=trunc(xp_total)),
  level numeric NOT NULL CHECK(level>=1 AND level=trunc(level)),
  ovr integer NOT NULL CHECK(ovr BETWEEN 0 AND 99), body jsonb NOT NULL,
  UNIQUE(id,club_id)
);
CREATE INDEX IF NOT EXISTS athletes_club_idx ON athletes(club_id,id);
CREATE TABLE IF NOT EXISTS lineup_slots(
  club_id uuid NOT NULL REFERENCES clubs(id), slot integer NOT NULL CHECK(slot BETWEEN 1 AND 5), athlete_id uuid NOT NULL,
  PRIMARY KEY(club_id,slot), UNIQUE(club_id,athlete_id), FOREIGN KEY(athlete_id,club_id) REFERENCES athletes(id,club_id)
);
CREATE TABLE IF NOT EXISTS wallets(
  club_id uuid PRIMARY KEY REFERENCES clubs(id), balance numeric NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance=trunc(balance)), version bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS matches(
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id), sequence bigint NOT NULL,
  state text NOT NULL CHECK(state IN ('RUNNING','SETTLED')), start_at bigint NOT NULL, end_at bigint NOT NULL,
  seed text NOT NULL, body jsonb NOT NULL, CHECK(end_at-start_at=90000), UNIQUE(club_id,sequence)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_match ON matches(club_id) WHERE state='RUNNING';
CREATE INDEX IF NOT EXISTS matches_history_idx ON matches(club_id,sequence DESC);
CREATE INDEX IF NOT EXISTS matches_due_idx ON matches(state,end_at);
CREATE TABLE IF NOT EXISTS reward_grants(
  id text PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id), match_id uuid NOT NULL REFERENCES matches(id),
  kind text NOT NULL, target_key text NOT NULL, amount numeric NOT NULL CHECK(amount>=0 AND amount=trunc(amount)), payload jsonb NOT NULL,
  UNIQUE(match_id,kind,target_key)
);
CREATE TABLE IF NOT EXISTS coin_ledger_entries(
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id), match_id uuid NOT NULL UNIQUE REFERENCES matches(id),
  delta numeric NOT NULL CHECK(delta>0 AND delta=trunc(delta)), balance_after numeric NOT NULL CHECK(balance_after>=0),
  wallet_version bigint NOT NULL, created_at bigint NOT NULL, UNIQUE(club_id,wallet_version)
);
CREATE INDEX IF NOT EXISTS ledger_club_idx ON coin_ledger_entries(club_id,wallet_version DESC);
CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Coin ledger is append-only'; END;
$$;
DROP TRIGGER IF EXISTS immutable_ledger ON coin_ledger_entries;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON coin_ledger_entries FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TABLE IF NOT EXISTS inventory_balances(
  club_id uuid NOT NULL REFERENCES clubs(id), material_id text NOT NULL, quantity numeric NOT NULL CHECK(quantity>=0 AND quantity=trunc(quantity)),
  PRIMARY KEY(club_id,material_id)
);
CREATE TABLE IF NOT EXISTS inventory_movements(
  grant_id text PRIMARY KEY REFERENCES reward_grants(id), club_id uuid NOT NULL REFERENCES clubs(id), material_id text NOT NULL, delta numeric NOT NULL CHECK(delta>0)
);
CREATE TABLE IF NOT EXISTS club_region_unlocks(
  club_id uuid NOT NULL REFERENCES clubs(id), region_id text NOT NULL CHECK(region_id IN ('VARZEA','REGIONAL')), unlocked_at bigint NOT NULL,
  PRIMARY KEY(club_id,region_id)
);
CREATE TABLE IF NOT EXISTS idempotency_records(
  account_id uuid NOT NULL REFERENCES accounts(id), operation text NOT NULL, key text NOT NULL,
  request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,operation,key)
);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
