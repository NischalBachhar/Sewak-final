// Preserve trigger bodies when applying versioned migrations through D1.
export function sqlStatements(source) {
 const parts=source.replace(/^\s*--.*$/gm,'').split(';'),out=[];let trigger='';
 for(const part of parts){const sql=part.trim();if(!sql)continue;if(trigger){trigger+=';'+sql;if(sql==='END'){out.push(trigger);trigger='';}}else if(/^CREATE\s+TRIGGER\b/i.test(sql)){trigger=sql;}else out.push(sql);}
 if(trigger)throw new Error('Unterminated SQL trigger');return out;
}
