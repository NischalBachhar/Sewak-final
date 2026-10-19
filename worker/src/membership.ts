import { Repository, requireActive } from './repository.ts';
import { badInput, onlyKeys, requireThat, type Actor, type Data } from './types.ts';

const allowed = ['free','plus_preview'] as const;
export async function membershipRoute(request:Request, repo:Repository, actor:Actor|null, input:Data={}) {
 const user=requireActive(actor);
 requireThat(user.role==='user','Membership preferences are for customer accounts only.');
 if(request.method==='GET'){
  const result=await repo.env.DB.prepare('SELECT tier,updated_at AS updatedAt FROM care_membership_preferences WHERE user_id=?')
    .bind(user.uid).first<Data>();
  return {tier:result?.tier||'free',updatedAt:result?.updatedAt||null,mode:'demo-only',
    charged:false,priceNpr:0,realSubscription:false};
 }
 requireThat(request.method==='POST','Unsupported membership method.',405,'method-not-allowed');
 requireThat(repo.env.APP_WRITES_ENABLED==='true','Membership previews are read-only during maintenance.',503,'maintenance');
 onlyKeys(input,['tier','acknowledgeDemo']);
 badInput(allowed.includes(input.tier),'Choose a valid demo plan.');
 badInput(input.acknowledgeDemo===true,'Confirm you understand no paid subscription is created.');
 const stamp=new Date().toISOString();
 await repo.commit([],[repo.env.DB.prepare(`INSERT INTO care_membership_preferences(user_id,tier,updated_at)
 VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier,updated_at=excluded.updated_at`)
    .bind(user.uid,input.tier,stamp)]);
 return {tier:input.tier,updatedAt:stamp,mode:'demo-only',charged:false,priceNpr:0,realSubscription:false};
}
