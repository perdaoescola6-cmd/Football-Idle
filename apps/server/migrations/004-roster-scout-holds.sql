CREATE TABLE sale_quotes(id uuid PRIMARY KEY,club_id uuid NOT NULL REFERENCES clubs(id),body jsonb NOT NULL,expires_at bigint NOT NULL,consumed boolean NOT NULL DEFAULT false);
CREATE INDEX quotes_expiry ON sale_quotes(club_id,expires_at);
CREATE TABLE coin_holds(offer_id uuid PRIMARY KEY,listing_id uuid NOT NULL REFERENCES market_listings(id),club_id uuid NOT NULL REFERENCES clubs(id),amount numeric NOT NULL CHECK(amount>0 AND amount=trunc(amount)),expires_at bigint NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE INDEX holds_club ON coin_holds(club_id,active,expires_at);
CREATE INDEX athlete_storage ON athletes(club_id,(body->>'storage')) WHERE active;
INSERT INTO schema_migrations(version) VALUES(4);
ALTER TABLE athletes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX roster_revision_idx ON athletes(club_id,updated_at DESC);
