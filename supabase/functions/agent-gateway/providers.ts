import type {ChatMessage,ProviderResult} from "./types.ts";
export const PROVIDERS={
  groq:{label:"Основной AI",url:"https://api.groq.com/openai/v1/chat/completions",models:["openai/gpt-oss-20b","openai/gpt-oss-120b","qwen/qwen3.8-27b"]},
  gemini:{label:"AI для изображений и файлов",url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",models:["gemini-3.7-flash"]},
  mistral:{label:"Дополнительный AI",url:"https://api.mistral.ai/v1/chat/completions",models:["mistral-small-latest"]},
  openrouter:{label:"Дополнительный маршрут",url:"https://openrouter.ai/api/v1/chat/completions",models:["openrouter/free"]}
} as const;
const keys=()=>{let j:any={};try{j=JSON.parse(Deno.env.get("AI_PROVIDER_KEYS")||"{}")}catch{};return{groq:j.groq||Deno.env.get("GROQ_API_KEY")||"",gemini:j.gemini||Deno.env.get("GEMINI_API_KEY")||"",mistral:j.mistral||Deno.env.get("MISTRAL_API_KEY")||"",openrouter:j.openrouter||Deno.env.get("OPENROUTER_API_KEY")||""}};
export function normalizeMessages(messages:ChatMessage[]){return (Array.isArray(messages)?messages:[]).slice(-12).map(m=>{const x:any={role:m.role,content:m.content};if(m.tool_calls)x.tool_calls=m.tool_calls;if(m.tool_call_id)x.tool_call_id=m.tool_call_id;if(m.name)x.name=m.name;if(typeof x.content==="string")x.content=x.content.slice(0,m.role==="tool"?2000:4000);else if(Array.isArray(x.content))x.content=x.content.map((p:any)=>p?.type==="text"?{type:"text",text:String(p.text||"").slice(0,4000)}:p?.type==="image_url"&&p.image_url?.url?p:{type:"text",text:"Прикреплённый материал."});return x})}
export function chooseProvider(requested:string,messages:ChatMessage[]){if(requested&&requested!=="auto"&&requested in PROVIDERS)return requested as keyof typeof PROVIDERS;const rich=messages.some(m=>Array.isArray(m.content)&&m.content.some((p:any)=>p?.type==="image_url"));return rich?"gemini":"groq"}
export async function callProvider(provider:string,messages:ChatMessage[],system:string,tools:any[]):Promise<ProviderResult>{
 const order=[provider,...Object.keys(PROVIDERS).filter(p=>p!==provider)];
 let lastErr="provider_unavailable";
 for(const name of order){
  const cfg=(PROVIDERS as any)[name],key=keys()[name];
  if(!cfg||!key)continue;
  for(const model of cfg.models){
   const body:any={model,messages:[{role:"system",content:String(system||"")},...normalizeMessages(messages)],max_tokens:900};
   if(name==="groq"&&(model==="openai/gpt-oss-20b"||model==="openai/gpt-oss-120b"))body.reasoning_effort="low";
   if(name==="mistral")body.reasoning_effort="none";
   if(name==="gemini")body.reasoning_effort="low";
   if(tools.length){body.tools=tools.slice(0,40);body.tool_choice="auto"}
   const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),25000);
   try{
    const r=await fetch(cfg.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},body:JSON.stringify(body),signal:ac.signal});
    const data=await r.json().catch(()=>({}));
    if(r.ok&&data.choices?.[0]?.message)return{message:data.choices[0].message,usage:data.usage||{},provider:name,model};
    lastErr="provider_http_"+r.status;
    console.error("provider_failed",name,model,r.status,String(data?.error?.message||data?.error||"unknown").slice(0,500));
   }catch(e){
    lastErr=e instanceof DOMException&&e.name==="AbortError"?"provider_timeout":"provider_network_error";
    console.error("provider_failed",name,model,lastErr);
   }finally{clearTimeout(timer)}
  }
 }
 throw new Error(lastErr);
}
// Production failover marker: 2026-10-06
