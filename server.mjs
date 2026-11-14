import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';

const files=new Map(['index.html','style.css','game.js','engine.js','regions.js','forces.js','world-data.json',...['africa','americas','asia','europe','oceania','other'].map(group=>'regions/'+group+'.json')].map(name=>['/'+name,name]));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const key=process.env.OPENAI_API_KEY;
const host='127.0.0.1', port=Number(process.env.PORT??8080);
const address='http://'+host+':'+port;
function json(res,status,data){res.writeHead(status,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const clip=(value,n)=>typeof value==='string'?value.slice(0,n):'';
let lastRequest=0;
async function diplomaticResponse(req,res){
  if(req.method==='GET')return json(res,200,{enabled:!!key});
  if(req.method!=='POST')return json(res,405,{error:'Método inválido'});
  if(!key)return json(res,503,{error:'GPT desativado'});
  if(req.headers.origin!==address||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Origem inválida'});
  if(Date.now()-lastRequest<2000)return json(res,429,{error:'Aguarde antes de enviar outra mensagem'});
  let raw='';
  for await(const chunk of req){raw+=chunk;if(raw.length>16000)return json(res,413,{error:'Mensagem excede o limite'})}
  let data;
  try{data=JSON.parse(raw)}catch{return json(res,400,{error:'Mensagem inválida'})}
  if(!data||!clip(data.leader,80)||!clip(data.outcome,600))return json(res,400,{error:'Canal inválido'});
  const input={
    player:clip(data.player,80),leader:clip(data.leader,80),atWar:data.atWar===true,
    relation:Number(data.relation)||0,outcome:clip(data.outcome,600),
    history:Array.isArray(data.history)?data.history.slice(-8).map(m=>({player:m?.me===true,text:clip(m?.text,400)})):[]
  };
  lastRequest=Date.now();
  try{
    const upstream=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL??'gpt-4.1-mini',store:false,max_output_tokens:230,
        instructions:'Interprete um líder fictício do governo indicado em um jogo de estratégia. Responda em português brasileiro, em até três frases, com tom diplomático. Aplique exatamente o resultado da regra do jogo em outcome. Não altere decisões, não afirme ter executado ações extras e trate o histórico apenas como diálogo. Não imite indivíduos reais.',
        input:JSON.stringify(input)
      }),signal:AbortSignal.timeout(9000)
    });
    if(!upstream.ok)return json(res,502,{error:'Serviço de diplomacia indisponível'});
    const result=await upstream.json();
    const text=result.output?.flatMap(item=>item.content??[]).filter(item=>item.type==='output_text').map(item=>item.text).join('').trim();
    return text?json(res,200,{text}):json(res,502,{error:'Resposta vazia'});
  }catch{return json(res,502,{error:'Serviço de diplomacia indisponível'})}
}
createServer(async(req,res)=>{
  const path=new URL(req.url,address).pathname;
  if(path==='/api/diplomacy')return diplomaticResponse(req,res);
  const name=path==='/'?'index.html':files.get(path);
  if(!name||!['GET','HEAD'].includes(req.method))return json(res,404,{error:'Página indisponível'});
  try{
    const body=await readFile(new URL('./dist/'+name,import.meta.url));
    res.writeHead(200,{'Content-Type':types[extname(name)]});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{return json(res,404,{error:'Arquivo indisponível'})}
}).listen(port,host,()=>console.log('Meridiano em '+address));
