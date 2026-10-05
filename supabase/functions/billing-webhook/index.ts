import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22";
import { createClient } from "npm:@supabase/supabase-js@2";
const ok=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json"}});
function key(){try{const n=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return n.default||Object.values(n)[0]||""}catch{return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}}
async function aesKey(){const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key()));return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"])}
async function encrypt(v:string){const k=await aesKey(),iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(v));return btoa(JSON.stringify({iv:[...iv],ct:[...new Uint8Array(ct)]}))}
function gen(){const b=new Uint8Array(32);crypto.getRandomValues(b);return "AGENT-"+btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hash(v:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{try{
 if(req.method!=="POST")return ok({ok:true});
 const raw=await req.text(),sig=req.headers.get("stripe-signature")||"",stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2025-06-30.basil"}),event=await stripe.webhooks.constructEventAsync(raw,sig,Deno.env.get("STRIPE_WEBHOOK_SECRET")!,await Stripe.createSubtleCryptoProvider());
 const db=createClient(Deno.env.get("SUPABASE_URL")!,key());const {data:dup}=await db.from("agent_payment_events").select("id").eq("event_id",event.id).maybeSingle();if(dup)return ok({received:true,duplicate:true});
 let orderId="",paid=false;if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){const s=event.data.object as Stripe.Checkout.Session;orderId=String(s.metadata?.order_id||"");paid=event.type.endsWith("completed")?s.payment_status==="paid":true}
 await db.from("agent_payment_events").insert({provider:"stripe",event_id:event.id,event_type:event.type,order_id:orderId||null,payload:{id:event.id,type:event.type}});
 if(!orderId||!paid)return ok({received:true});
 const {data:order}=await db.from("agent_payment_orders").select("*,agent_plans(*)").eq("id",orderId).single();if(!order)return ok({received:true});if(order.status==="paid"&&order.access_key_id)return ok({received:true,already_fulfilled:true});
 const p=order.agent_plans,secret=gen(),h=await hash(secret),expires=new Date(Date.now()+Number(p.days)*86400000).toISOString(),cipher=await encrypt(secret);
 const {data:access,error:ae}=await db.from("agent_access_keys").insert({key_prefix:secret.slice(0,15),key_hash:h,user_id:order.user_id,plan:p.id,status:"active",expires_at:expires,daily_limit:p.daily_limit,monthly_limit:p.monthly_limit}).select().single();if(ae)throw ae;
 await db.from("agent_payment_orders").update({status:"paid",paid_at:new Date().toISOString(),access_key_id:access.id,metadata:{key_ciphertext:cipher,key_available:true}}).eq("id",order.id);
 return ok({received:true,fulfilled:true});
}catch(e){console.error(e);return ok({error:"webhook_error"},400)}});