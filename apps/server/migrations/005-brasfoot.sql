CREATE TABLE football_audit (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES clubs(id),
  created_at bigint NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX football_audit_club ON football_audit(club_id,created_at);
CREATE TRIGGER immutable_football_audit BEFORE UPDATE OR DELETE ON football_audit FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
INSERT INTO schema_migrations(version) VALUES(5);
