CREATE TABLE evidence_blobs (
 id TEXT PRIMARY KEY,
 ciphertext BLOB NOT NULL CHECK(length(ciphertext)<=500033),
 created_at TEXT NOT NULL
);
CREATE TABLE evidence_capacity(id INTEGER PRIMARY KEY CHECK(id=1),used_bytes INTEGER NOT NULL CHECK(used_bytes>=0 AND used_bytes<=400000000));
-- Tombstones close the delete/late-upload race across two databases.
CREATE TABLE evidence_tombstones(id TEXT PRIMARY KEY,deleted_at TEXT NOT NULL);
CREATE TRIGGER evidence_no_resurrection BEFORE INSERT ON evidence_blobs
WHEN EXISTS(SELECT 1 FROM evidence_tombstones WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'Evidence was deleted'); END;
INSERT INTO evidence_capacity VALUES(1,0);
CREATE TRIGGER evidence_capacity_insert AFTER INSERT ON evidence_blobs BEGIN
 UPDATE evidence_capacity SET used_bytes=used_bytes+length(NEW.ciphertext) WHERE id=1;
END;
CREATE TRIGGER evidence_capacity_delete AFTER DELETE ON evidence_blobs BEGIN
 UPDATE evidence_capacity SET used_bytes=used_bytes-length(OLD.ciphertext) WHERE id=1;
END;
CREATE TRIGGER evidence_immutable BEFORE UPDATE ON evidence_blobs BEGIN
 SELECT RAISE(ABORT,'Evidence is immutable');
END;
