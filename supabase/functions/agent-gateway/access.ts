import type {Access} from "./types.ts";

export function secretKey(){
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
  if(raw){
    try{
      const n:any=JSON.parse(raw);
      const candidates=[n.default,n.service_role,n.serviceRole,n.secret,n.secret_key,n.service_role_key,n.supabase_service_role_key,n.SUPABASE_SERVICE_ROLE_KEY];
      const k=candidates.find((v:any)=>typeof v==="string"&&v.trim());
      if(k)return k.trim();
    }catch{}
  }
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"").trim();
}
async function sha256(v:string){
  const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function authHeaders(sk:string){
  return {apikey:sk,Authorization:"Bearer "+sk,"Content-Type":"application/json"};
}
export async function consumeAccess(key:string):Promise<Access|null>{
  const url=Deno.env.get("SUPABASE_URL"),sk=secretKey();
  if(!url||!sk)throw new Error("gateway_db");
  const hash=await sha256(key);
  const r=await fetch(url+"/rest/v1/rpc/consume_agent_request",{
    method:"POST",headers:authHeaders(sk),
    body:JSON.stringify({p_key_hash:hash,p_daily_limit:500,p_monthly_limit:10000})
  });
  if(!r.ok){console.error("access_consume_http",r.status);throw new Error("gateway_db");}
  const j=await r.json();
  return Array.isArray(j)?j[0]||null:j||null;
}
export {secretKey};
export async function validateAccess(key:string):Promise<Access|null>{
  const url=Deno.env.get("SUPABASE_URL"),sk=secretKey();
  if(!url||!sk)throw new Error("gateway_db");
  const hash=await sha256(key);
  const r=await fetch(url+"/rest/v1/agent_access_keys?key_hash=eq."+encodeURIComponent(hash)+"&status=eq.active&select=id,user_id,plan,expires_at&limit=1",{headers:authHeaders(sk)});
  if(!r.ok){console.error("access_validate_http",r.status);throw new Error("gateway_db");}
  const j=await r.json();
  const x=Array.isArray(j)?j[0]:null;
  if(!x)return null;
  if(x.expires_at&&new Date(x.expires_at).getTime()<=Date.now())return null;
  return {...x,key_id:x.id,user_id:x.user_id??null} as Access;
}