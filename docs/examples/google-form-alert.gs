// Install in the response Sheet, with an installable "On form submit" trigger.
// Script Properties: ADMIN_EMAIL, RESPONSES_SHEET_ID, RESPONSES_SHEET_NAME.
// Do not publish this as a web app. Never include response contents in email.
function onFormSubmit(event) {
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try {
  const props=PropertiesService.getScriptProperties(),sheet=event&&event.range&&event.range.getSheet();
  if(!sheet||sheet.getParent().getId()!==props.getProperty('RESPONSES_SHEET_ID')||sheet.getName()!==props.getProperty('RESPONSES_SHEET_NAME'))throw new Error('Unexpected response sheet');
  const recipient=props.getProperty('ADMIN_EMAIL');if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient||''))throw new Error('Configure one authorized administrator address');
  const lastResponseColumn=event.range.getColumn()+event.range.getNumColumns()-1;
  // Set this fixed column in Script Properties after setup; never move it.
  const configured=Number(props.getProperty('ALERT_STATUS_COLUMN')||0);
  if(!Number.isInteger(configured)||configured<=lastResponseColumn)throw new Error('Configure ALERT_STATUS_COLUMN beyond all form response columns');
  const status=sheet.getRange(event.range.getRow(),configured);
  if(status.getValue()==='accepted')return;
  if(MailApp.getRemainingDailyQuota()<1){status.setValue('deferred_quota');return;}
  MailApp.sendEmail({to:recipient,subject:'New Sewak general form response',body:'A new general feedback or partnership response is available in the restricted response Sheet. Open Google Sheets to review it. Do not forward sensitive details.'});
  status.setValue('accepted'); // MailApp submission is not proof of inbox delivery.
 } finally {lock.releaseLock();}
}
// Retry rows marked deferred_quota manually by invoking the handler with their
// range from an authorized operator script. A crash after MailApp accepts but
// before the marker is written can duplicate an alert; MailApp has no provider
// idempotency key. This example is never used for Sewak authentication email.
