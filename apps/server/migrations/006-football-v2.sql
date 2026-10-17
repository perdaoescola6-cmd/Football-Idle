CREATE TABLE football_card_listings (
 id uuid PRIMARY KEY,
 seller_id uuid NOT NULL REFERENCES clubs(id),
 card_id uuid NOT NULL,
 edition_id text NOT NULL,
 price numeric NOT NULL CHECK(price>0 AND price=trunc(price)),
 created_at bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('OPEN','SOLD','CANCELLED')),
 buyer_id uuid REFERENCES clubs(id),
 closed_at bigint,
 card jsonb NOT NULL
);
CREATE UNIQUE INDEX football_one_card_listing ON football_card_listings(card_id) WHERE status='OPEN';
CREATE INDEX football_open_market ON football_card_listings(status,created_at);
CREATE TABLE football_card_transfers (
 listing_id uuid PRIMARY KEY REFERENCES football_card_listings(id),
 card_id uuid NOT NULL,
 seller_id uuid NOT NULL REFERENCES clubs(id),
 buyer_id uuid NOT NULL REFERENCES clubs(id),
 total numeric NOT NULL CHECK(total>0),
 commission numeric NOT NULL CHECK(commission>=0),
 created_at bigint NOT NULL
);
CREATE TRIGGER football_immutable_transfers BEFORE UPDATE OR DELETE ON football_card_transfers FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
INSERT INTO schema_migrations(version) VALUES(6);
