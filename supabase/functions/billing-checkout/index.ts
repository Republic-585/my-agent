import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return out({ok:true});
 try{
  const auth=req.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))return out({error:"auth_required"},401);
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SECRET_KEYS")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
  const {data:{user},error:ue}=await supabase.auth.getUser(auth.slice(7));if(ue||!user)return out({error:"auth_required"},401);
  const body=await req.json().catch(()=>({})),planId=String(body.plan_id||"pro");
  const {data:plan,error:pe}=await supabase.from("agent_plans").select("*").eq("id",planId).eq("active",true).single();if(pe||!plan)return out({error:"plan_not_found"},404);
  const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2025-06-30.basil"});
  const {data:order,error:oe}=await supabase.from("agent_payment_orders").insert({user_id:user.id,plan_id:plan.id,provider:"stripe",amount_cents:plan.price_cents,currency:plan.currency,status:"pending"}).select().single();if(oe||!order)throw oe||new Error("order_create");
  const base=Deno.env.get("APP_URL")||req.headers.get("origin")||"";
  const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:user.email||undefined,line_items:[{price_data:{currency:plan.currency.toLowerCase(),product_data:{name:plan.title,description:plan.description||undefined},unit_amount:plan.price_cents},quantity:1}],success_url:base+"/?payment=success&order="+order.id,cancel_url:base+"/?payment=cancelled&order="+order.id,metadata:{order_id:order.id,user_id:user.id,plan_id:plan.id}});
  await supabase.from("agent_payment_orders").update({provider_checkout_id:session.id}).eq("id",order.id);
  return out({ok:true,checkout_url:session.url,order_id:order.id});
 }catch(e){console.error(e);return out({error:"checkout_unavailable"},503)}
});