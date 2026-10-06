import {secretKey} from "./access.ts";

type ToolRisk = "low" | "medium" | "high";
type ToolDefinition = {
  name:string;
  description:string;
  category:"system"|"data"|"communication"|"integration"|"development";
  risk:ToolRisk;
  requires_confirmation:boolean;
  server_only:boolean;
  input_schema:Record<string,unknown>;
};

export const TOOL_REGISTRY:ToolDefinition[]=[
  {name:"get_time",description:"Текущая дата и время сервера",category:"system",risk:"low",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{}}},
  {name:"calculator",description:"Безопасный калькулятор арифметических выражений",category:"system",risk:"low",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{expression:{type:"string"}},required:["expression"]}},
  {name:"weather",description:"Текущая погода по городу",category:"system",risk:"low",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{city:{type:"string"}},required:["city"]}},
  {name:"wikipedia",description:"Краткая справка из Википедии",category:"system",risk:"low",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{query:{type:"string"},lang:{type:"string"}},required:["query"]}},
  {name:"supabase",description:"Работа с бизнес-данными Supabase через серверные полномочия",category:"data",risk:"medium",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{action:{type:"string"},table:{type:"string"},query:{type:"string"},body:{type:"object"}},required:["action"]}},
  {name:"github",description:"Работа с GitHub через серверный токен без удаления файлов",category:"development",risk:"high",requires_confirmation:true,server_only:true,input_schema:{type:"object",properties:{action:{type:"string"},repo:{type:"string"},path:{type:"string"},content:{type:"string"},sha:{type:"string"}},required:["action"]}},
  {name:"telegram",description:"Вызов Telegram Bot API через серверный токен",category:"communication",risk:"medium",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{method:{type:"string"},params:{type:"object"}},required:["method"]}},
  {name:"http_request",description:"Безопасный HTTPS-запрос к внешнему бизнес-API",category:"integration",risk:"medium",requires_confirmation:false,server_only:true,input_schema:{type:"object",properties:{method:{type:"string"},url:{type:"string"},headers:{type:"object"},query:{type:"object"},body:{type:["object","array","string","number","boolean","null"]},timeout_ms:{type:"integer"}},required:["method","url"]}}
];

export const serverTools:any[]=TOOL_REGISTRY.map(t=>({type:"function",function:{name:t.name,description:t.description,parameters:t.input_schema}}));
export const serverToolNames=new Set(TOOL_REGISTRY.map(t=>t.name));
export const toolRegistryByName=new Map(TOOL_REGISTRY.map(t=>[t.name,t]));

const calc=(v:string)=>{const e=String(v).replace(/\^/g,"**");if(!/^[0-9+\-*/().,%\s*]+$/.test(e))throw new Error("invalid_expression");return String(Function('"use strict";return ('+e.replace(/,/g,".")+')')())};
async function j(u:string){const r=await fetch(u);if(!r.ok)throw new Error("tool_http");return r.json()}
const b64=(s:string)=>{const bytes=new TextEncoder().encode(s);let bin="";for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin)};

export async function executeTool(name:string,args:any){
  switch(name){
    case"get_time":return new Date().toLocaleString("ru-RU",{dateStyle:"full",timeStyle:"short"});
    case"calculator":return calc(args.expression);
    case"weather":{const g=await j("https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name="+encodeURIComponent(args.city));if(!g.results?.length)return"Город не найден";const c=g.results[0],w=await j(`https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation`);return JSON.stringify({город:c.name,страна:c.country,...w.current})}
    case"wikipedia":{const l=args.lang==="en"?"en":"ru";const s=await j(`https://${l}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=`+encodeURIComponent(args.query));const t=s.query?.search?.[0]?.title;if(!t)return"Ничего не найдено";const x=await j(`https://${l}.wikipedia.org/api/rest_v1/page/summary/`+encodeURIComponent(t));return t+": "+x.extract}
    case"supabase":{const table=String(args.table||"");if(!/^agent_[a-z0-9_]+$/.test(table)&&table!=="admin_users")throw new Error("table_forbidden");const action=String(args.action||"read").toLowerCase();if(!["read","insert","update"].includes(action))throw new Error("action_forbidden");const url=Deno.env.get("SUPABASE_URL"),key=secretKey(),path="/rest/v1/"+table+(args.query?"?"+args.query:"");const init:any={method:action==="read"?"GET":action==="insert"?"POST":"PATCH",headers:{apikey:key,"Content-Type":"application/json",Prefer:"return=representation"}};if(action!=="read")init.body=JSON.stringify(args.body||{});const r=await fetch(url+path,init),txt=await r.text();if(!r.ok)throw new Error("supabase_tool_error");return txt.slice(0,8000)}
    case"github":{const token=Deno.env.get("GITHUB_TOKEN");if(!token)throw new Error("github_secret_missing");const repo=String(args.repo||"Republic-585/my-agent"),path=String(args.path||""),base="https://api.github.com/repos/"+repo,h={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2026-03-10"},action=String(args.action||"").toLowerCase();if(action==="list")return JSON.stringify(await(await fetch("https://api.github.com/user/repos?sort=updated&per_page=30",{headers:h})).json());if(action==="get_file"){const r=await fetch(base+"/contents/"+path,{headers:h}),x=await r.json();return r.ok?JSON.stringify({path:x.path,sha:x.sha,content:x.content?atob(String(x.content).replace(/\n/g,"")):""}):"GitHub error"}if(action==="put_file"){if(!path||!args.content)throw new Error("missing_file");const r=await fetch(base+"/contents/"+path,{method:"PUT",headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({message:"agent update "+path,content:b64(String(args.content)),...(args.sha?{sha:args.sha}:{})})});const x=await r.json();if(!r.ok)throw new Error("github_write_failed");return JSON.stringify({ok:true,path:x.content?.path,sha:x.content?.sha})}if(action==="status"){const r=await fetch("https://api.github.com/repos/"+repo+"/actions/runs?per_page=3",{headers:h});return JSON.stringify(await r.json())}throw new Error("github_action_forbidden")}
    case"telegram":{const token=Deno.env.get("TELEGRAM_BOT_TOKEN");if(!token)throw new Error("telegram_secret_missing");const method=String(args.method||"getMe");if(/^(delete|ban|restrict|leave|refund|unban)/i.test(method))throw new Error("telegram_action_forbidden");const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args.params||{})});return(await r.text()).slice(0,6000)}
    case"http_request":{const method=String(args.method||"GET").toUpperCase();if(!["GET","POST","PUT","PATCH","DELETE"].includes(method))throw new Error("http_method_forbidden");const raw=String(args.url||"");let u:URL;try{u=new URL(raw)}catch{throw new Error("http_url_invalid")}if(u.protocol!=="https:")throw new Error("http_https_required");const host=u.hostname.toLowerCase();if(host==="localhost"||host.endsWith(".localhost")||host==="metadata.google.internal"||host==="169.254.169.254"||/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)||host==="0.0.0.0")throw new Error("http_private_host");const q=args.query&&typeof args.query==="object"?args.query:{};for(const [k,v] of Object.entries(q))u.searchParams.set(k,String(v));const headers:any={"Accept":"application/json","User-Agent":"my-agent/1.0",...(args.headers&&typeof args.headers==="object"?args.headers:{})};delete headers.host;delete headers["content-length"];const timeout=Math.min(Math.max(Number(args.timeout_ms)||15000,1000),30000);const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeout);let r:Response;try{r=await fetch(u,{method,headers,signal:ac.signal,body:["GET","DELETE"].includes(method)?undefined:(typeof args.body==="string"?args.body:args.body==null?undefined:JSON.stringify(args.body))})}catch(e){clearTimeout(timer);throw new Error(e instanceof DOMException&&e.name==="AbortError"?"http_timeout":"http_network_error")}clearTimeout(timer);const txt=(await r.text()).slice(0,12000);return JSON.stringify({status:r.status,ok:r.ok,url:u.toString(),body:txt})}
    default:throw new Error("unknown_server_tool")
  }
}