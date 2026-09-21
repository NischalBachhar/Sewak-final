import { calculateQuote, kathmanduDate, normalizePhone, scheduleBoundary, validateBooking } from "./bookingValidation";
import { caregiverProfilePatch } from "./caregiverProfile";
import { formatNpr } from "./config/brand";
const caregiver={hourlyRate:500,commissionRate:0,workType:"parttime",servicesOffered:["care"]};
const input={careRecipient:"Test recipient",serviceId:"care",date:"2030-01-01",time:"10:00",requestedTimeWindows:[],durationHours:4,recurrence:"one_time",userName:"Test Customer",userPhone:"9800000000",address:"Test Street",city:"Hetauda",notes:"",careNeeds:""};
test("validates all steps on final submit",()=>{expect(validateBooking(input,caregiver,new Date("2029-01-01"))).toEqual([]);expect(validateBooking({...input,careRecipient:" ",userName:""},caregiver)[0].step).toBe(0);});
test.each([{durationHours:0},{durationHours:25},{durationHours:1.5},{date:"2030-02-30"},{time:"99:00"},{recurrence:"forever"},{userPhone:"123"},{serviceId:"unsupported"},{requestedTimeWindows:["unknown"]}])("rejects invalid booking data %j",patch=>{expect(validateBooking({...input,...patch},caregiver,new Date("2029-01-01")).length).toBeGreaterThan(0);});
test("uses Kathmandu rather than browser timezone and rejects elapsed same-day schedules",()=>{
 expect(kathmanduDate(new Date("2029-12-31T20:00:00Z"))).toBe("2030-01-01");
 expect(scheduleBoundary(input).toISOString()).toBe("2030-01-01T04:15:00.000Z");
 expect(validateBooking(input,caregiver,new Date("2030-01-01T05:00:00Z"))[0].step).toBe(1);
});
test("supports part-time time-window requests only",()=>{
 const request={...input,time:"",requestedTimeWindows:["morning","night"]};
 expect(validateBooking(request,caregiver,new Date("2029-01-01"))).toEqual([]);
 expect(validateBooking(request,{...caregiver,workType:"fulltime"},new Date("2029-01-01")).length).toBeGreaterThan(0);
});
test("normalizes Nepal and international phone formats",()=>{expect(normalizePhone("980 000 0000")).toBe("+9779800000000");expect(normalizePhone("+44 (20) 1234-5678")).toBe("+442012345678");});
test("preserves zero commission and rounds money in minor units",()=>{
 expect(calculateQuote(caregiver,4).platformCommission).toBe(0);
 expect(calculateQuote({...caregiver,hourlyRate:10.01,commissionRate:12.5},3)).toMatchObject({totalAmount:30.03,platformCommission:3.75,vendorEarnings:26.28});
 expect(()=>calculateQuote({...caregiver,hourlyRate:0},4)).toThrow();
 expect(calculateQuote({...caregiver,hourlyRate:0,allowZeroRate:true},4).totalAmount).toBe(0);
 expect(formatNpr(0)).toBe("NPR 0");
});
test("general caregiver editor rejects ownership and safety changes",()=>{
 const profile={name:"Test Name",phone:"",location:"Hetauda",bio:"",hourlyRate:500,experience:2};
 expect(caregiverProfilePatch(profile).name).toBe("Test Name");
 for(const key of ["role","organizationId","isSuspended","isApproved","verified"])expect(()=>caregiverProfilePatch({...profile,[key]:"forged"})).toThrow(/Only profile/);
});
