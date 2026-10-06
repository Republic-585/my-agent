import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-webhook-secret","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
async function sha256(v:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return json({ok:true});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const secret=req.headers.get("x-webhook-secret")?.trim()||"";
  if(secret.length<20)return json({error:"invalid_webhook_secret"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)return json({error:"webhook_config"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const hash=await sha256(secret);
  const {data:hook,error}=await db.from("agent_webhooks").select("id,enabled").eq("secret_hash",hash).eq("enabled",true).maybeSingle();
  if(error)return json({error:"webhook_db"},503);
  if(!hook)return json({error:"webhook_denied"},403);
  const raw=await req.text();
  let payload:any=null;try{payload=raw?JSON.parse(raw):null}catch{payload={raw:raw.slice(0,12000)}}
  const headers:any={};for(const [k,v] of req.headers){if(/^authorization$|^cookie$|^x-webhook-secret$/i.test(k))continue;headers[k]=v.slice(0,1000)}
  const {data:event,error:insertError}=await db.from("agent_webhook_events").insert({webhook_id:hook.id,method:req.method,headers,payload}).select("id").single();
  if(insertError)return json({error:"webhook_store_failed"},503);
  return json({ok:true,event_id:event.id},202);
});
