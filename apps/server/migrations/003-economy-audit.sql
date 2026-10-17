CREATE TABLE market_transfers(
 listing_id uuid PRIMARY KEY REFERENCES market_listings(id), athlete_id uuid NOT NULL REFERENCES athletes(id),
 seller_id uuid NOT NULL REFERENCES clubs(id), buyer_id uuid NOT NULL REFERENCES clubs(id),
 total numeric NOT NULL CHECK(total>0 AND total=trunc(total)),
 commission numeric NOT NULL CHECK(commission>=0 AND commission<=total AND commission=trunc(commission)),
 created_at bigint NOT NULL, CHECK(seller_id<>buyer_id)
);
CREATE TRIGGER immutable_market_transfer BEFORE UPDATE OR DELETE ON market_transfers FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TABLE inventory_adjustments(
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id), material_id text NOT NULL,
 delta numeric NOT NULL CHECK(delta<>0 AND delta=trunc(delta)), reason text NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX inventory_adjustments_club ON inventory_adjustments(club_id,created_at);
CREATE TRIGGER immutable_inventory_adjustments BEFORE UPDATE OR DELETE ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
INSERT INTO schema_migrations(version) VALUES(3);
