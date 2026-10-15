import { compressVerificationImage } from './verificationImages';
import { getCaregiverVerification } from './bookingModel';
import { resolveVerificationState } from './components/CareExperience';
test.each(['not_submitted','pending','under_review','more_information_required','verified','rejected','expired','revoked'])('verification status %s retains its meaning',state=>{expect(resolveVerificationState(state).key).toBe(state);});
test('legacy booleans and unaudited status strings never become trusted UI badges',()=>{
  expect(getCaregiverVerification({verified:true,isCertified:true,backgroundChecked:true,identityVerificationStatus:'verified'}).every(c=>c.state==='not_submitted')).toBe(true);
  expect(getCaregiverVerification({verificationSource:'audited_v1',identityVerificationStatus:'verified'})[0].state).toBe('verified');
});
test('image compression rejects unsupported documents before decoding',async()=>{await expect(compressVerificationImage({type:'application/pdf',size:100})).rejects.toThrow('PDFs are not supported');});
test('image compression enforces decimal 10 MB original limit',async()=>{await expect(compressVerificationImage({type:'image/jpeg',size:10000001})).rejects.toThrow('10,000,000');});
test('image compression rejects unreadable source and releases decoded resources',async()=>{
  const close=jest.fn();global.createImageBitmap=jest.fn().mockResolvedValue({width:400,height:600,close});
  await expect(compressVerificationImage({type:'image/jpeg',size:1000})).rejects.toThrow('at least 600');expect(close).toHaveBeenCalled();delete global.createImageBitmap;
});
