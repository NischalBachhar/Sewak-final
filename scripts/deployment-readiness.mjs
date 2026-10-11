// Retry only explicit propagation/service-unavailable observations. Every
// security, payload and binding assertion must still pass before Auth QA.
const stages=new Set(['deployment.activation','smoke.health','smoke.anonymous','smoke.invalid-cookie','smoke.browse']);
export class DeploymentPending extends Error {
  constructor(stage){super('Deployment readiness is pending.');this.stage=stages.has(stage)?stage:'unknown-stage';}
}
export async function waitForDeploymentReady(check,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onPending=()=>{}}={}){
  for(let attempt=1;attempt<=15;attempt++){
    try{return await check();}
    catch(error){
      if(!(error instanceof DeploymentPending)||attempt===15)throw error;
      onPending({stage:error.stage,attempt});
      await sleep(2000);
    }
  }
}
