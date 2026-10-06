import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-webhook-secret,x-telegram-bot-api-secret-token","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
async function sha256(v:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return json({ok:true});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const secret=(req.headers.get("x-webhook-secret")||req.headers.get("x-telegram-bot-api-secret-token"))?.trim()||"";
  if(secret.length<20)return json({error:"invalid_webhook_secret"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)return json({error:"webhook_config"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const hash=await sha256(secret);
  const {data:hook,error}=await db.from("agent_webhooks").select("id,enabled,connection_id").eq("secret_hash",hash).eq("enabled",true).maybeSingle();
  if(error)return json({error:"webhook_db"},503);
  if(!hook)return json({error:"webhook_denied"},403);
  const raw=await req.text();
  let payload:any=null;try{payload=raw?JSON.parse(raw):null}catch{payload={raw:raw.slice(0,12000)}}
  const headers:any={};for(const [k,v] of req.headers){if(/^authorization$|^cookie$|^x-webhook-secret$|^x-telegram-bot-api-secret-token$/i.test(k))continue;headers[k]=v.slice(0,1000)}
  const {data:event,error:insertError}=await db.from("agent_webhook_events").insert({webhook_id:hook.id,method:req.method,headers,payload}).select("id").single();
  if(insertError)return json({error:"webhook_store_failed"},503);
  const userId=hook.connection_id?(await db.from("agent_connections").select("user_id").eq("id",hook.connection_id).maybeSingle()).data?.user_id??null;
  const updateId=payload?.update_id!==undefined?String(payload.update_id):null;
  await db.from("agent_events").insert({user_id:userId,connection_id:hook.connection_id||null,source_event_id:event.id,external_event_id:updateId,event_type:"telegram.update",payload,status:"received"});
  const chat=payload?.message?.chat||payload?.edited_message?.chat||payload?.channel_post?.chat||payload?.edited_channel_post?.chat||payload?.callback_query?.message?.chat||null;
  if(chat?.id!==undefined){
    const text=payload?.message?.text??payload?.edited_message?.text??payload?.channel_post?.text??payload?.edited_channel_post?.text??payload?.callback_query?.data??null;
    await db.from("agent_telegram_chats").upsert({webhook_id:hook.id,chat_id:String(chat.id),chat_type:chat.type??null,username:chat.username??null,first_name:chat.first_name??null,last_name:chat.last_name??null,last_message_text:text===null?null:String(text).slice(0,4000),last_seen_at:new Date().toISOString()},{onConflict:"webhook_id,chat_id"});
    if(hook.connection_id)await db.from("agent_resources").upsert({connection_id:hook.connection_id,user_id:userId,resource_type:"telegram_chat",external_id:String(chat.id),name:chat.title||([chat.first_name,chat.last_name].filter(Boolean).join(" ")||null),username:chat.username??null,status:"active",metadata:{chat_type:chat.type??null,title:chat.title??null,username:chat.username??null,first_name:chat.first_name??null,last_name:chat.last_name??null},last_seen_at:new Date().toISOString()},{onConflict:"connection_id,external_id"});
  }
  return json({ok:true,event_id:event.id,telegram_chat_id:chat?.id!==undefined?String(chat.id):null},202);
});
// Deployment pipeline trigger: individual Edge Function deployment.

// Trigger Supabase deployment after workflow fix
