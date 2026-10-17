ALTER TABLE athletes ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE coin_ledger_entries ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE coin_ledger_entries DROP CONSTRAINT coin_ledger_entries_delta_check;
ALTER TABLE coin_ledger_entries ADD CONSTRAINT signed_integer_coins CHECK(delta<>0 AND delta=trunc(delta));
ALTER TABLE coin_ledger_entries ADD COLUMN reason text NOT NULL DEFAULT 'MATCH_REWARD';
ALTER TABLE club_region_unlocks DROP CONSTRAINT club_region_unlocks_region_id_check;
ALTER TABLE club_region_unlocks ADD CONSTRAINT known_region CHECK(region_id IN ('VARZEA','REGIONAL','ESTADUAL','NACIONAL','CONTINENTAL','EUROPA','ELITE'));
CREATE TABLE economy_mutex(id integer PRIMARY KEY CHECK(id=1));
INSERT INTO economy_mutex VALUES(1);
CREATE TABLE market_listings(
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES clubs(id), athlete_id uuid NOT NULL REFERENCES athletes(id),
 price numeric NOT NULL CHECK(price>0 AND price=trunc(price)), expires_at bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('OPEN','SOLD','CANCELLED','EXPIRED')), body jsonb NOT NULL
);
CREATE UNIQUE INDEX one_listing_per_athlete ON market_listings(athlete_id) WHERE status='OPEN';
CREATE INDEX market_open_expiry ON market_listings(status,expires_at);
INSERT INTO schema_migrations(version) VALUES(2);
