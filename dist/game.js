import {MODES,route,annualDefense,strength,round,newCampaign,log,relation,changeRelation,weeklyFunds,advance,negotiate} from './engine.js';
const $=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'US$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+' bi';
const format=n=>new Intl.NumberFormat('pt-BR').format(n);
const {countries,places}=await fetch('./world-data.json').then(r=>{if(!r.ok)throw Error('Mapa indisponível');return r.json()}).catch(error=>{$('mapstatus').textContent=error.message;throw error});
const codes=Object.keys(countries).filter(c=>places[c]?.length).sort((a,b)=>countries[a][0].localeCompare(countries[b][0],'pt-BR'));
const key='meridiano-campanha-v1';
let state;
try{state=JSON.parse(localStorage.getItem(key))}catch{}
let target=state?.code==='ARG'?'BRA':'ARG', tab='ops', layer='politico', mode='land', selected=0, originIndex=0, units=10, zoom=1, offset=[0,0], toastTimer, pendingChat=false;
const flag=c=>/^[A-Z]{2}$/.test(countries[c][1])?[...countries[c][1]].map(a=>String.fromCodePoint(a.charCodeAt()+127397)).join(''):'◈';
const date=t=>new Date(Date.UTC(2026,10,14+(t-1)*7)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const cap=c=>places[c]?.find(p=>p[3])??places[c]?.[0];
const svgPoint=(lon,lat)=>[(lon+180)*10/3,(84-lat)*3.5];
function notice(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4300)}
function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function update(){save();draw()}
function modal(title,body){$('modal-title').textContent=title;$('modal-body').innerHTML=body;if(!$('modal').open)$('modal').showModal()}
const sample=newCampaign('BRA',countries);
function start(code){
  state=newCampaign(code,countries);target=code==='BRA'?'ARG':'BRA';selected=0;originIndex=0;mode=code==='BRA'?'land':'air';tab='ops';units=10;
  log(state,'Campanha iniciada. '+countries[code][0]+' está sob seu comando.');
  $('modal').close();reset();update();notice('Comando assumido: '+countries[code][0]);
}
$('close').onclick=()=>$('modal').close();
$('new').onclick=()=>choose();
function choose(){
  modal('Escolha sua nação','<p>Explore o mapa mundial e comande um país. Cada turno corresponde a uma semana.</p><form id="pick" class="form"><label>Buscar país<input id="query" type="search" placeholder="Ex.: Brasil, Japão, França"></label><label>Nação<select id="pick-code"></select></label><div class="hint" id="pick-details"></div>'+(state?'<p class="hint">Iniciar uma campanha substitui a partida salva neste navegador.</p>':'')+'<button class="primary" type="submit">Assumir comando →</button></form>');
  const normalize=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  function options(q){
    const list=codes.filter(c=>normalize(countries[c][0]).includes(normalize(q)));
    $('pick-code').innerHTML=list.map(c=>'<option value="'+c+'" '+(c===(state?.code??'BRA')?'selected':'')+'>'+flag(c)+' '+safe(countries[c][0])+'</option>').join('');
    details();
  }
  function details(){const c=$('pick-code').value;$('pick-details').textContent=c?safeText(cap(c)?.[0])+' · Defesa anual: '+money(annualDefense(countries[c]))+' · Força: '+strength(countries[c])+' un.':'Nenhum país encontrado.'}
  $('query').oninput=e=>options(e.target.value);$('pick-code').onchange=details;
  $('pick').onsubmit=e=>{e.preventDefault();if($('pick-code').value)start($('pick-code').value)};
  options('');
}
function safeText(s){return s??'—'}
$('guide').onclick=()=>modal('Como jogar','<ol><li>Escolha uma nação e clique em outro território para inspecioná-lo.</li><li>Use a aba Diplomacia para negociar comércio ou cessar-fogo. Declare guerra para disputar cidades e capitais.</li><li>Selecione origem, destino e rota. Envie unidades e avance turnos para resolver a missão.</li><li>Clique no cartão Orçamento para ajustar o repasse e mobilizar unidades. O registro mostra receitas, perdas e ações estrangeiras.</li></ol><p>Arraste o mapa e use a rolagem ou os controles para aproximar. Sua campanha é salva neste navegador.</p>');
$('sources').onclick=()=>modal('Dados e metodologia','<p><b>Economia.</b> PIB nominal em dólares, ano-base 2025, <a href="https://data.imf.org/Datasets/WEO" target="_blank" rel="noopener">FMI World Economic Outlook</a>. O cenário usa a edição de outubro de 2026.</p><p><b>Defesa.</b> Gasto militar 2025 de 40 países do <a href="https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025" target="_blank" rel="noopener">SIPRI</a>. Nos demais, o jogo estima 1,7% do PIB com piso de US$ 0,01 bi. O caixa inicial usa 15% do gasto de referência com piso de US$ 0,25 bi. O repasse semanal é gasto anual ÷ 52 × alocação.</p><p><b>Força.</b> Unidades abstratas calculadas com gasto de defesa e PIB. O índice inicial arredonda 10 × defesa<sup>0,48</sup> + 2 × PIB<sup>0,35</sup>, com piso de três unidades. Distância, modalidade e unidades afetam as missões.</p><p><b>Mapa.</b> Fronteiras e localidades do <a href="https://www.naturalearthdata.com/downloads/110m-cultural-vectors/" target="_blank" rel="noopener">Natural Earth</a>, escala 1:110 milhões. As rotas usam pontos de passagem selecionados e estimativas de distância, com cobertura parcial.</p>');
$('next').onclick=()=>{if(!state)return choose();advance(state,countries);update();notice('Turno '+state.turn+' · '+date(state.turn))};
function pickTarget(code,city=0){
  if(!countries[code])return;
  if(code===state?.code){originIndex=city;drawPanel();drawMap();notice('Origem: '+(places[code]?.[city]?.[0]??countries[code][0]));return}
  target=code;selected=city;
  if(!route(active().code,target,origin(),destination(),mode))mode=['land','sea','air'].find(m=>route(active().code,target,origin(),destination(),m))??'air';
  draw();
}
const active=()=>state??sample;
const origin=()=>places[active().code]?.[originIndex]??cap(active().code);
const destination=()=>places[target]?.[selected]??cap(target);
const getRoute=()=>route(active().code,target,origin(),destination(),mode);
const box=(label,value)=>'<div class="cell"><small>'+label+'</small><b>'+value+'</b></div>';
function draw(){
  const s=active(),c=countries[s.code],n=countries[target];
  $('date').textContent=date(s.turn);
  $('campaign').textContent=(state?flag(s.code)+' '+c[0]:'Campanha individual')+' · Cenário contemporâneo · Turno '+s.turn;
  const metrics=[['▤','PIB nominal',c[3]?money(c[3]):'—','FMI · 2025'],['◈','Orçamento',money(s.treasury),'CAIXA DISPONÍVEL'],['▥','Forças na reserva',format(s.units)+' un.','ÍNDICE SIMULADO'],['⚑','Conflitos ativos',String(Object.keys(s.wars).length),Object.keys(s.pacts).length+' ACORDO(S) COMERCIAIS']];
  $('metrics').innerHTML=metrics.map(([icon,label,value,sub],i)=>'<'+(i===1?'button id="budget" aria-label="Ajustar orçamento e mobilizar tropas"':'div')+' class="metric"><div class="icon" aria-hidden="true">'+icon+'</div><div style="text-align:left"><label>'+label+'</label><strong>'+value+'</strong><small>'+sub+'</small></div></'+(i===1?'button':'div')+'>').join('');
  $('budget').onclick=budget;
  const war=s.wars[target],pact=s.pacts[target],conquered=s.occupied[target]?.includes(cap(target)?.[0]);
  $('nation').innerHTML='<div class="nation-title"><div class="flag">'+flag(target)+'</div><div><h2>'+safe(n[0])+'</h2><p class="nation-meta">'+safe(cap(target)?.[3]?cap(target)[0]+' · Capital':cap(target)?.[0]||n[2]||'Território')+'</p></div><span class="status '+(war?'war':'')+'">'+(war?'EM GUERRA':conquered?'OCUPADA':pact?'ACORDO':'EM PAZ')+'</span></div><div class="nation-data">'+box('PIB 2025',n[3]?money(n[3]):'Sem dado')+box('DEFESA '+(n[4]==null?'ESTIMADA':'2025'),money(annualDefense(n)))+box('FORÇA INICIAL',strength(n)+' un.')+box('RELAÇÃO',String(relation(s,target)))+'</div>';
  $('log').innerHTML=s.logs.length?s.logs.slice(0,8).map(l=>'<div class="line"><time>T'+l.turn+'</time><span>'+safe(l.text)+'</span></div>').join(''):'<p class="empty">O registro começa quando você assume uma nação.</p>';
  $('missions').innerHTML=s.queues.length?s.queues.map(m=>'<div class="line"><time>T'+m.eta+'</time><span><b>'+safe(m.city)+'</b> · '+MODES[m.mode].label+' · '+m.units+' un.</span></div>').join(''):'<p class="empty">Nenhuma ordem em trânsito.</p>';
  drawPanel();drawMap();
}
function budget(){
  if(!state)return choose();
  const c=countries[state.code],price=round(Math.max(.06,annualDefense(c)/strength(c)*.15));
  modal('Orçamento de defesa','<div class="form"><p>Gasto anual de referência <b>'+money(annualDefense(c))+'</b> · Caixa <b>'+money(state.treasury)+'</b></p><label>Alocação <span id="funding-label"></span><input type="range" id="funding" min="25" max="200" value="'+state.funding+'"></label><p class="hint" id="budget-preview"></p><button id="apply-budget" class="primary">Salvar alocação</button><button id="recruit" '+(state.treasury<price*5?'disabled':'')+'>Mobilizar 5 unidades · '+money(price*5)+'</button></div>');
  const inp=$('funding');
  function show(){$('funding-label').textContent=inp.value+'%';$('budget-preview').textContent='Repasse semanal bruto: '+money(annualDefense(c)/52*Number(inp.value)/100)+' · Manutenção atual: '+money(state.units*.0015+Object.keys(state.wars).length*.025)}
  show();inp.oninput=show;
  $('apply-budget').onclick=()=>{state.funding=Number(inp.value);log(state,'Alocação de defesa ajustada para '+state.funding+'%.');$('modal').close();update()};
  $('recruit').onclick=()=>{if(state.treasury<price*5)return;state.treasury=round(state.treasury-price*5);state.units+=5;log(state,'Cinco unidades foram mobilizadas.');$('modal').close();update()};
}
const cityOptions=(c,i)=> (places[c]??[]).map((p,j)=>'<option value="'+j+'" '+(i===j?'selected':'')+'>'+safe(p[0])+(p[3]?' ★':'')+'</option>').join('');
function drawPanel(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='chat')return drawChat();
  const s=active(),r=getRoute(),available=Math.min(Math.max(1,units),s.units);
  $('panel').innerHTML='<div class="form"><div class="row2"><label>Origem<select id="origin">'+cityOptions(s.code,originIndex)+'</select></label><label>Destino<select id="destination">'+cityOptions(target,selected)+'</select></label></div><div class="row2"><label>Modalidade<select id="mode">'+Object.entries(MODES).map(([k,m])=>'<option value="'+k+'" '+(mode===k?'selected':'')+'>'+m.label+'</option>').join('')+'</select></label><label>Unidades<input id="units" type="number" min="1" max="'+s.units+'" value="'+available+'"></label></div><p class="hint" id="route-info">'+(r?safe(r.name)+'<br>'+format(r.km)+' km · '+r.turns+' turno(s) · '+money(r.cost):'Sem rota cadastrada nesta modalidade.')+'</p><div class="actions"><button class="primary" id="dispatch" '+(!r||s.units===0?'disabled':'')+'>Enviar ordem</button><button class="danger" id="war" '+(s.wars[target]||s.occupied[target]?.includes(cap(target)?.[0])?'disabled':'')+'>Declarar guerra</button></div></div>';
  $('origin').onchange=e=>{originIndex=Number(e.target.value);drawPanel();drawMap()};
  $('destination').onchange=e=>{selected=Number(e.target.value);drawPanel();drawMap()};
  $('mode').onchange=e=>{mode=e.target.value;drawPanel();drawMap()};
  $('units').oninput=e=>{units=Number(e.target.value)};
  $('war').onclick=()=>{
    if(!state)return choose();
    const opponent=target;
    modal('Declarar guerra','<p>As operações contra <b>'+safe(countries[opponent][0])+'</b> passam a disputar cidades. O acordo comercial, se houver, será suspenso.</p><button id="confirm-war" class="danger">Confirmar declaração</button>');
    $('confirm-war').onclick=()=>{state.wars[opponent]=true;delete state.pacts[opponent];changeRelation(state,opponent,-60);log(state,'Guerra declarada contra '+countries[opponent][0]+'.');$('modal').close();update()};
  };
  $('dispatch').onclick=()=>{
    if(!state)return choose();
    const p=destination(),amount=Number($('units').value);
    if(!Number.isInteger(amount)||amount<1||amount>state.units)return notice('Informe uma quantidade válida de unidades.');
    if(state.treasury<r.cost)return notice('Caixa insuficiente para esta missão.');
    if(state.occupied[target]?.includes(p[0]))return notice('Esta cidade já está sob seu controle.');
    if(state.queues.some(q=>q.to===target&&q.city===p[0]))return notice('Já existe uma missão em trânsito para esta cidade.');
    state.treasury=round(state.treasury-r.cost);state.units-=amount;
    state.queues.push({...r,from:state.code,to:target,city:p[0],capital:p[3],population:p[4],units:amount,eta:state.turn+r.turns});
    log(state,amount+' un. enviadas para '+p[0]+'. Chegada no turno '+(state.turn+r.turns)+'.');update();notice('Ordem registrada.');
  };
}
let gpt=false;
fetch('/api/diplomacy',{headers:{Accept:'application/json'}}).then(r=>r.ok&&r.headers.get('content-type')?.includes('application/json')?r.json():null).then(config=>{gpt=config?.enabled===true;if(tab==='chat')drawChat()}).catch(()=>{});
function drawChat(){
  const messages=state?.chats[target]??[];
  $('panel').innerHTML='<div class="form"><div class="hint">Canal com '+safe(countries[target][0])+' · '+(gpt?'GPT + regras de campanha':'Líder simulado')+'</div><div class="chat" id="messages" role="log">'+(messages.length?messages.map(m=>'<div class="bubble '+(m.me?'me':'')+'"><b>'+safe(m.me?'Seu governo':countries[target][0])+'</b>'+safe(m.text)+'</div>').join(''):'<p class="hint">Abra a negociação com uma proposta ou envie uma mensagem.</p>')+'</div><div class="quick"><button data-propose="trade">Acordo comercial</button><button data-propose="peace">Cessar-fogo</button><button data-propose="threat">Advertência</button></div><form class="chat-entry" id="send"><input id="message" maxlength="400" required aria-label="Mensagem diplomática" placeholder="Envie uma mensagem"><button class="primary" aria-label="Enviar mensagem">→</button></form></div>';
  $('messages').scrollTop=$('messages').scrollHeight;
  $('panel').querySelectorAll('[data-propose]').forEach(b=>b.onclick=()=>send({trade:'Propomos um acordo comercial.',peace:'Propomos um cessar-fogo.',threat:'Advertimos que nossa posição poderá endurecer.'}[b.dataset.propose],b.dataset.propose));
  $('send').onsubmit=e=>{e.preventDefault();send($('message').value.trim(),'message')};
}
async function send(message,proposal){
  if(!state)return choose();
  if(!message||pendingChat)return;
  const campaign=state,opponent=target;
  const history=campaign.chats[opponent]??=[];
  history.push({me:true,text:message});
  const outcome=negotiate(campaign,opponent,proposal,countries);
  const reply={me:false,text:outcome};history.push(reply);
  if(history.length>40)history.splice(0,history.length-40);
  update();
  if(!gpt)return;
  pendingChat=true;
  try{
    const request=await fetch('/api/diplomacy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:countries[campaign.code][0],leader:countries[opponent][0],outcome,atWar:!!campaign.wars[opponent],relation:relation(campaign,opponent),history:history.slice(-9,-1)}),signal:AbortSignal.timeout(12000)});
    if(!request.ok)throw Error('GPT indisponível');
    const response=await request.json();if(response.text)reply.text=response.text;
    if(state===campaign)update();
  }catch{notice('Resposta das regras de campanha mantida.')}finally{pendingChat=false}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;drawPanel()});
document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{layer=b.dataset.layer;document.querySelectorAll('[data-layer]').forEach(x=>x.classList.toggle('on',x===b));drawMap()});
const palette={Europe:'#4b6574',Americas:'#445f59',Asia:'#526471',Africa:'#566057',Oceania:'#4e6170'};
const fromColor='#397e68', targetColor='#52787d', warColor='#8c494f', occupiedColor='#8d784f';
function fillCountry(code){
  const s=active(),c=countries[code];
  if(code===s.code)return fromColor;
  if(s.wars[code])return warColor;
  if(s.occupied[code]?.includes(cap(code)?.[0]))return occupiedColor;
  if(layer==='economia'&&c[3])return 'hsl(166 34% '+Math.min(60,17+Math.log10(c[3]+1)*9)+'%)';
  if(code===target)return targetColor;
  return layer==='politico'?(palette[c[2]]??'#455862'):'#354650';
}
$('land').innerHTML=Object.entries(countries).filter(([,c])=>c[5]).map(([code,c])=>'<path class="country" data-code="'+code+'" d="'+c[5]+'" fill-rule="evenodd"><title>'+safe(c[0])+'</title></path>').join('');
const countryPaths=[...$('land').children];
function drawMap(){
  const s=active();
  countryPaths.forEach(p=>{const c=p.dataset.code;p.style.fill=fillCountry(c);p.classList.toggle('selected',c===target)});
  const markers=[];
  for(const code of codes){
    const list=places[code],priority=code===target||code===s.code;
    list.forEach((p,j)=>{
      if(!priority && (zoom<1.7||(!p[3]&&(zoom<3||p[4]<800000))))return;
      if(priority&&j>0&&zoom<1.45&&j!==(code===target?selected:originIndex)&&!(p[4]>5000000&&j<4))return;
      if(priority&&j>14&&zoom<3)return;
      const [x,y]=svgPoint(p[1],p[2]),show=priority||zoom>2.3,focus=priority&&j===(code===target?selected:originIndex);
      markers.push('<g class="city '+(focus?'active':'')+'" data-code="'+code+'" data-city="'+j+'" transform="translate('+x+' '+y+') scale('+1/Math.sqrt(zoom)+')"><circle r="'+(focus?3.9:p[3]?3.1:2.2)+'" class="'+(p[3]?'cap':'')+'"/>'+(show?'<text x="5" y="'+(j===0?-4:7)+'">'+safe(p[0])+'</text>':'')+'<title>'+safe(p[0])+'</title></g>');
    });
  }
  $('markers').innerHTML=markers.join('');
  const r=getRoute();
  const plotted=[...s.queues.map(r=>[r,false]),...(r?[[r,true]]:[])];
  $('routes').innerHTML=plotted.map(([path,preview])=>{
    const lines=[[]];
    path.points.forEach((p,i)=>{
      if(i&&Math.abs(p[1]-path.points[i-1][1])>180){
        const prev=path.points[i-1],edge=prev[1]>0?180:-180;
        const fraction=(edge-prev[1])/(p[1]+edge*2-prev[1]);
        const lat=prev[2]+fraction*(p[2]-prev[2]);
        lines.at(-1).push(svgPoint(edge,lat).join(','));
        lines.push([svgPoint(-edge,lat).join(',')]);
      }
      lines.at(-1).push(svgPoint(p[1],p[2]).join(','));
    });
    return lines.map(points=>'<polyline points="'+points.join(' ')+'" fill="none" stroke="'+(preview?'#80e7bc':'#f2bd6a')+'" opacity=".94" stroke-width="'+(preview?1.8:2.3)+'" stroke-dasharray="'+(preview?'4 4':'7 3')+'" vector-effect="non-scaling-stroke" pointer-events="none"/>').join('');
  }).join('');
  $('legend').innerHTML=[[fromColor,'Sob seu comando'],[warColor,'Em guerra'],[occupiedColor,'Capitulou'],['#e6c784','Capital'],['#80e7bc','Rota prevista'],...(layer==='economia'?[['#6ec2a6','PIB mais alto']]:[])].map(([color,label])=>'<span><i class="key" style="background:'+color+'"></i>'+label+'</span>').join('');
  $('mapstatus').textContent=Object.keys(countries).length+' TERRITÓRIOS · '+Object.values(places).reduce((n,p)=>n+p.length,0)+' LOCALIDADES';
  updateCamera();
}
function updateCamera(){$('camera').setAttribute('transform','translate('+offset.join(' ')+') scale('+zoom+')');$('coords').textContent=zoom===1?'VISÃO GLOBAL':'ZOOM '+zoom.toFixed(1).replace('.',',')+'×'}
function setZoom(next,x=600,y=265){
  const newZoom=Math.max(1,Math.min(9,next));
  offset=newZoom===1?[0,0]:[x-(x-offset[0])*newZoom/zoom,y-(y-offset[1])*newZoom/zoom];
  zoom=newZoom;drawMap();
}
function reset(){zoom=1;offset=[0,0];updateCamera()}
$('plus').onclick=()=>setZoom(zoom*1.4);
$('minus').onclick=()=>setZoom(zoom/1.4);
$('home').onclick=()=>{reset();drawMap()};
const map=$('map');
function coordinates(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse());return [p.x,p.y]}
map.onwheel=e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.25:.8),...coordinates(e))};
let pan;
map.onpointerdown=e=>{if(e.button!==0)return;pan={start:coordinates(e),from:[...offset],clicked:e.target.closest('[data-code]'),moved:false};map.setPointerCapture(e.pointerId)};
map.onpointermove=e=>{if(!pan)return;const [x,y]=coordinates(e),dx=x-pan.start[0],dy=y-pan.start[1];if(Math.hypot(dx,dy)>5)pan.moved=true;if(pan.moved&&zoom>1){offset=[Math.max(1200*(1-zoom),Math.min(0,pan.from[0]+dx)),Math.max(530*(1-zoom),Math.min(0,pan.from[1]+dy))];updateCamera()}};
map.onpointerup=()=>{const c=pan?.clicked;if(c&&!pan.moved)pickTarget(c.dataset.code,Number(c.dataset.city??0));pan=null};
map.onpointercancel=()=>{pan=null};
draw();
if(!state)choose();
