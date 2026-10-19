import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sqlStatements} from './sql-statements.mjs';

// Full filenames are authoritative: both historical 0010 migrations are distinct.
export const marketplaceMigrations=[
 ['0007_care_jobs.sql','care_jobs'],['0008_care_messages.sql','care_messages'],
 ['0009_care_notifications.sql','care_notifications'],['0010_caregiver_time_off.sql','caregiver_time_off'],
 ['0010_membership_demo.sql','care_membership_preferences'],['0011_caregiver_weekly_hours.sql','caregiver_weekly_hours'],
 ['0012_notification_preferences.sql','care_notification_preferences'],
];
export function migrationPlan({journal=[],tables=[],directory='migrations/main'}={}){
 return marketplaceMigrations.map(([name,table])=>{
   const source=readFileSync(directory+'/'+name,'utf8').replace(/\r\n/g,'\n');
   const hash=createHash('sha256').update(source).digest('hex');
   const previous=journal.find(row=>row.name===name);
   if(previous?.hash&&previous.hash!==hash)throw new Error('Recorded migration hash differs: '+name);
   if(previous?.applied_at){
     if(!tables.includes(table))throw new Error('Applied migration table is missing: '+name);
     return {name,hash,table,applied:true,statements:[]};
   }
   if(previous||tables.includes(table))throw new Error('Partial or unjournaled marketplace schema requires review: '+name);
   const statements=sqlStatements(source);
   if(!statements.length||statements.some(sql=>!/^CREATE (?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS\s/i.test(sql)))throw new Error('Only reviewed additive CREATE statements are permitted: '+name);
   return {name,hash,table,applied:false,statements};
 });
}
