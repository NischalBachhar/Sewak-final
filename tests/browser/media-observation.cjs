// Test instrumentation only. Observe the Blob returned to the real app without
// fetching its object URL, replacing response bytes, or altering CSP.
async function observeMediaBlobs(context){
 await context.addInitScript(()=>{
  const observations=[];const byBlob=new WeakMap();
  window.__sewakMediaObservations=observations;
  window.__sewakMediaBytes=new Map();
  const readBlob=Response.prototype.blob;
  Response.prototype.blob=async function(...args){
   const blob=await readBlob.apply(this,args);
   if(new URL(this.url||location.href).pathname.startsWith('/api/media/')&&this.ok){
    const buffer=await blob.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    const entry={requestId:this.headers.get('x-sewak-test-request-id'),path:new URL(this.url).pathname,status:this.status,mime:this.headers.get('content-type'),blobBytes:blob.size,arrayBufferBytes:buffer.byteLength,sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''),objectUrlCreated:false};
    window.__sewakMediaBytes.set(entry.requestId,new Uint8Array(buffer));
    byBlob.set(blob,entry);observations.push(entry);
   }
   return blob;
  };
  const createObjectURL=URL.createObjectURL;
  URL.createObjectURL=function(blob){
   const url=createObjectURL.call(this,blob);const entry=byBlob.get(blob);
   if(entry){entry.objectUrlCreated=true;entry.objectUrlBytes=blob.size;}
   return url;
  };
 });
}
module.exports={observeMediaBlobs};
