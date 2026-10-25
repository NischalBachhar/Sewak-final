import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteD1} from './harness.mjs';
import {applicationColumns,snapshotRecords} from '../../scripts/migration-snapshot.mjs';
test('additive columns preserve the preexisting record check; edits and deletions still fail it',async()=>{
 const db=sqliteD1();db.database.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);INSERT INTO users VALUES('u','Original')");
 const rows=async sql=>(await db.prepare(sql).all()).results;
 const columns=await applicationColumns(rows,['users']),before=await snapshotRecords(rows,columns);
 db.database.exec('ALTER TABLE users ADD COLUMN email_verified_at INTEGER');assert.deepEqual(await snapshotRecords(rows,columns),before);
 db.database.exec("UPDATE users SET name='Changed'");assert.notDeepEqual(await snapshotRecords(rows,columns),before);
 db.database.exec('DELETE FROM users');assert.notDeepEqual(await snapshotRecords(rows,columns),before);
});
