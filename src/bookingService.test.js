import { webcrypto } from "crypto";
import { TextEncoder } from "util";
import { createCashBooking, readAttempt } from "./bookingService";
import { calculateQuote } from "./bookingValidation";
import { getDocFromServer, runTransaction } from "firebase/firestore";
jest.mock("./firebaseConfig",()=>({db:{}}));
jest.mock("firebase/firestore",()=>({doc:(_db,collection,id)=>({collection,id}),getDocFromServer:jest.fn(),runTransaction:jest.fn(),serverTimestamp:()=>"SERVER_TIME",Timestamp:{fromDate:date=>date.toISOString()}}));
const caregiver={id:"caregiver",name:"Test",hourlyRate:500,commissionRate:0,servicesOffered:["care"],workType:"parttime"};
const input={careRecipient:"Test recipient",serviceId:"care",serviceLabel:"Care",date:"2090-01-01",time:"10:00",requestedTimeWindows:[],durationHours:4,recurrence:"one_time",userName:"Synthetic Name",userPhone:"9800000000",address:"Synthetic address",city:"Hetauda",notes:"PRIVATE CARE NOTES",careNeeds:"PRIVATE NEEDS"};
const user={uid:"customer",email:"customer@example.test"};
let saved;
beforeEach(()=>{
 Object.defineProperty(global,"crypto",{value:webcrypto,configurable:true});global.TextEncoder=TextEncoder;localStorage.clear();saved=null;jest.clearAllMocks();
 getDocFromServer.mockImplementation(async ref=>ref.collection==="publicCaregivers"?{exists:()=>true,data:()=>caregiver}:{id:ref.id,exists:()=>Boolean(saved),data:()=>saved});
 runTransaction.mockImplementation(async(_db,callback)=>callback({get:async()=>({exists:()=>Boolean(saved),data:()=>saved}),set:(_ref,value)=>{saved=value;}}));
});
const submit=()=>createCashBooking({user,caregiver,input,confirmedQuote:calculateQuote(caregiver,4)});
test("price changes require explicit confirmation before a write",async()=>{
 getDocFromServer.mockResolvedValue({exists:()=>true,data:()=>({...caregiver,hourlyRate:600})});
 expect((await submit()).changedQuote.totalAmount).toBe(2400);expect(runTransaction).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);
});
test("ambiguous retry returns original booking even if the current quote changes",async()=>{
 const first=await submit();caregiver.hourlyRate=700;
 const retry=await submit();expect(retry.id).toBe(first.id);expect(retry.totalAmount).toBe(2000);expect(runTransaction).toHaveBeenCalledTimes(1);caregiver.hourlyRate=500;
});
test("durable attempts contain only identifiers and fingerprints and reject changed payload",async()=>{
 await submit();const attempt=readAttempt(user.uid,caregiver.id);expect(Object.keys(attempt).sort()).toEqual(["fingerprint","id"]);
 expect(JSON.stringify(localStorage)).not.toMatch(/PRIVATE|Synthetic|980000/);
 await expect(createCashBooking({user,caregiver,input:{...input,notes:"different"},confirmedQuote:calculateQuote(caregiver,4)})).rejects.toThrow(/different details/);
});
test("attempts are scoped to the user",async()=>{await submit();expect(readAttempt("other",caregiver.id)).toBeNull();});
