import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function secretKey(){try{const n=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return n.default||Object.values(n)[0]||""}catch{return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}}
async function sb(path:string,init:RequestInit={}){const url=Deno.env.get("SUPABASE_URL"),key=secretKey();if(!url||!key)throw new Error("admin_config");const h=new Headers(init.headers||{});h.set("apikey",key);h.set("Authorization",`Bearer ${key}`);h.set("Content-Type","application/json");return fetch(`${url}${path}`,{...init,headers:h})}
async function sha256(v:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function generateKey(){const b=new Uint8Array(32);crypto.getRandomValues(b);const r=btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");return `AGENT-${r}`}
async function requireAdmin(req:Request){const a=req.headers.get("authorization")||"";if(!a.startsWith("Bearer "))return null;const t=a.slice(7).trim();if(!t)return null;const u=await sb("/auth/v1/user",{headers:{Authorization:`Bearer ${t}`}});if(!u.ok)return null;const user=await u.json();const r=await sb(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);if(!r.ok)throw new Error("admin_lookup");return (await r.json())?.length?user:null}
async function main(req:Request){
 if(req.method==="OPTIONS")return json({ok:true});
 const admin=await requireAdmin(req);if(!admin)return json({error:"admin_required"},403);
 const body=req.method==="POST"?await req.json().catch(()=>({})):{};const action=String(body.action||"list");
 if(action==="users"){
  const [ur,pr]=await Promise.all([
   sb("/auth/v1/admin/users?per_page=1000&page=1"),
   sb("/rest/v1/agent_profiles?select=user_id,display_name&order=created_at.desc")
  ]);
  if(!ur.ok)throw new Error("users_list");
  const uj=await ur.json(), profiles=pr.ok?await pr.json():[], pm=new Map(profiles.map((x:any)=>[x.user_id,x.display_name]));
  const users=(uj.users||[]).map((u:any)=>({id:u.id,email:u.email||"",name:pm.get(u.id)||u.user_metadata?.full_name||u.user_metadata?.name||""}));
  return json({ok:true,users});
 }
 if(action==="list"){const r=await sb("/rest/v1/agent_access_keys?select=id,key_prefix,user_id,plan,status,expires_at,daily_limit,monthly_limit,created_at,last_used_at&order=created_at.desc");if(!r.ok)throw new Error("keys_list");return json({ok:true,keys:await r.json(),admin:{id:admin.id,email:admin.email||""}})}
 if(action==="create"){
  const plan=String(body.plan||"pro").slice(0,40),dailyLimit=Math.max(1,Math.min(1000000,Number(body.daily_limit||500))),monthlyLimit=Math.max(1,Math.min(10000000,Number(body.monthly_limit||10000))),userId=body.user_id?String(body.user_id):null,expiresAt=body.expires_at?String(body.expires_at):null;
  if(userId){const check=await sb(`/rest/v1/agent_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);if(!check.ok||!(await check.json())?.length)return json({error:"invalid_user"},400)}
  const key=generateKey(),hash=await sha256(key);const r=await sb("/rest/v1/agent_access_keys",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({key_prefix:key.slice(0,15),key_hash:hash,user_id:userId,plan,status:"active",expires_at:expiresAt,daily_limit:dailyLimit,monthly_limit:monthlyLimit})});if(!r.ok)return json({error:"key_create_failed"},400);return json({ok:true,key,access:(await r.json())?.[0]||null},201)
 }
 const id=String(body.id||""),status=action==="revoke"?"revoked":action==="pause"?"paused":action==="resume"?"active":"";
 if(!id)return json({error:"missing_id"},400);if(!status)return json({error:"invalid_action"},400);
 const r=await sb(`/rest/v1/agent_access_keys?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status})});if(!r.ok)return json({error:"key_update_failed"},400);return json({ok:true,access:(await r.json())?.[0]||null})
}
Deno.serve(async req=>{try{return await main(req)}catch(e){console.error("admin_error",e instanceof Error?e.message:"unknown");return json({error:"admin_unavailable"},503)}});