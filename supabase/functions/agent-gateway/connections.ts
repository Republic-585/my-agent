const enc=new TextEncoder();
const dec=new TextDecoder();
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)};
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function keyFor(agentKey:string){const h=await crypto.subtle.digest("SHA-256",enc.encode(agentKey));return crypto.subtle.importKey("raw",h,{name:"AES-GCM"},false,["encrypt","decrypt"])}
export async function encryptCredential(value:string,agentKey:string){
 const iv=crypto.getRandomValues(new Uint8Array(12)),k=await keyFor(agentKey);
 const c=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,enc.encode(value)));
 return {ciphertext:b64(c),iv:b64(iv)};
}
export async function decryptCredential(ciphertext:string,iv:string,agentKey:string){
 const k=await keyFor(agentKey);
 const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},k,unb64(ciphertext));
 return dec.decode(p);
}
export async function telegramGetMe(token:string){
 const r=await fetch("https://api.telegram.org/bot"+token+"/getMe");
 const j=await r.json().catch(()=>null);
 if(!r.ok||!j?.ok||!j?.result)throw new Error("telegram_token_invalid");
 return j.result;
}

export async function telegramGetWebhookInfo(token:string){
 const r=await fetch("https://api.telegram.org/bot"+token+"/getWebhookInfo");
 const j=await r.json().catch(()=>null);
 if(!r.ok||!j?.ok||!j?.result)throw new Error("telegram_webhook_info_failed");
 return j.result;
}
