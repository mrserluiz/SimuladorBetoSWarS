import {planTransport,transportLabels,verifyTransport,nearbyAirports,airportSize} from './logistics.js?v=rail1';
import {islands} from './pacific.js';
import {stock,addStock} from './forces.js?v=world2';
import {world,sectors,report,nationalBudget,dailyTax,taxReference,setEmbargo,setBorder,warNews,tradeValue,refugeeCorridors} from './world-events.js?v=rail1';
import {equipment,portFor,regionalLinks,landSupply,seaSupply,garrison,changeGarrison,seedForces} from './forces.js?v=world2';
import {regionsFor,regionDestination,mineralRevenue} from './regions.js';
import {MODES,annualDefense,strength,round,newCampaign,log,relation,changeRelation,distance,seaTrade,tradePartners,advance,negotiate,migrateDailyTurns} from './engine.js?v=rail1';
const $=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'US$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+' bi';
const format=n=>new Intl.NumberFormat('pt-BR').format(n);
const {countries,places}=await fetch('./world-data.json?v=pacific1').then(r=>{if(!r.ok)throw Error('Mapa indisponível');return r.json()}).catch(error=>{$('mapstatus').textContent=error.message;throw error});
const codes=Object.keys(countries).filter(c=>places[c]?.length).sort((a,b)=>countries[a][0].localeCompare(countries[b][0],'pt-BR'));
const key='meridiano-campanha-v1';
const MAX_ZOOM=120, WORLD_WIDTH=1200;
const islandById=new Map(islands.map(row=>[row[0],row]));
const islandOwners=new Set(islands.map(row=>row[1]));
let state;
try{state=JSON.parse(localStorage.getItem(key));if(state)migrateDailyTurns(state)}catch{}
let target=state?.code==='ARG'?'BRA':'ARG', tab='ops', mode='auto', selected=0, originIndex=0, units=10, zoom=1, offset=[0,0], toastTimer, pendingChat=false;
const flag=c=>/^[A-Z]{2}$/.test(countries[c][1])?[...countries[c][1]].map(a=>String.fromCodePoint(a.charCodeAt()+127397)).join(''):'◈';
const date=t=>new Date(Date.UTC(2026,10,14+t-1)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const cap=c=>places[c]?.find(p=>p[3])??places[c]?.[0];
const svgPoint=(lon,lat)=>[(lon+180)*10/3,(84-lat)*3.5];
function notice(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4300)}
function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function update(){save();draw()}
function modal(title,body){$('modal-title').textContent=title;$('modal-body').innerHTML=body;if(!$('modal').open)$('modal').showModal()}
let selectedIsland=null;
let transportPreference='auto', mobility='vehicle';
let pickingRoute=false, originPicked=false, cargo=false;
let commandAtlas=[], commandRequest=0, forceOrigin='', forceType='infantry', forceCount=1, supplyVisible=false;
const linkCache=new WeakMap();
const linksFor=list=>{if(!linkCache.has(list))linkCache.set(list,regionalLinks(list,distance));return linkCache.get(list)};
let atlas=[], regionId=null, atlasCountry=null, atlasStatus="", atlasRequest=0;
const currentRegion=()=>atlas.find(r=>r[0]===regionId);
const sample=newCampaign('BRA',countries);
function start(code){
  state=newCampaign(code,countries);target=code==='BRA'?'ARG':'BRA';selected=0;originIndex=0;mode='auto';tab='ops';units=10;pickingRoute=false;originPicked=false;cargo=false;selectedIsland=null;
  log(state,'Campanha iniciada. '+countries[code][0]+' está sob seu comando.');
  atlas=[];regionId=null;atlasCountry=null;
  commandAtlas=[];forceOrigin='';forceType='infantry';forceCount=1;
  $('modal').close();reset();update();loadCommandAtlas();loadAtlas(code,true);notice('Comando assumido: '+countries[code][0]);
}
$('close').onclick=()=>$('modal').close();
$('new').onclick=()=>choose();
function choose(){
  modal('Escolha sua nação','<p>Explore o mapa mundial e comande um país. Cada turno corresponde a um dia.</p><form id="pick" class="form"><label>Buscar país<input id="query" type="search" placeholder="Ex.: Brasil, Japão, França"></label><label>Nação<select id="pick-code"></select></label><div class="hint" id="pick-details"></div>'+(state?'<p class="hint">Iniciar uma campanha substitui a partida salva neste navegador.</p>':'')+'<button class="primary" type="submit">Assumir comando →</button></form>');
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
$('sources').onclick=()=>modal('Dados e metodologia','<p><b>Economia.</b> PIB nominal em dólares, ano-base 2025, <a href="https://data.imf.org/Datasets/WEO" target="_blank" rel="noopener">FMI World Economic Outlook</a>. O cenário usa a edição de outubro de 2026.</p><p><b>Defesa.</b> Gasto militar 2025 de 40 países do <a href="https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025" target="_blank" rel="noopener">SIPRI</a>. Nos demais, o jogo estima 1,7% do PIB com piso de US$ 0,01 bi. O caixa inicial usa 15% do gasto de referência com piso de US$ 0,25 bi. O repasse semanal é gasto anual ÷ 52 × alocação.</p><p><b>Força.</b> Unidades abstratas calculadas com gasto de defesa e PIB. O índice inicial arredonda 10 × defesa<sup>0,48</sup> + 2 × PIB<sup>0,35</sup>, com piso de três unidades. Distância, modalidade e unidades afetam as missões.</p><p><b>Mapa.</b> Fronteiras e localidades do <a href="https://www.naturalearthdata.com/downloads/110m-cultural-vectors/" target="_blank" rel="noopener">Natural Earth</a>, escala 1:110 milhões. As rotas usam pontos de passagem selecionados e estimativas de distância, com cobertura parcial.</p><p><b>Províncias e minérios.</b> Fronteiras administrativas e capitais disponíveis do <a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/" target="_blank" rel="noopener">Natural Earth 1:10 milhões</a>. Cada área mineral tem fonte própria e receita definida para o jogo.</p>');
$('next').onclick=()=>{if(!state)return choose();advance(state,countries);update();notice('Turno '+state.turn+' · '+date(state.turn))};
function pickTarget(code,city=0){
  selectedIsland=null;
  $('island-select').value='';
  if(!countries[code])return;
  if(code===active().code){loadAtlas(code);originIndex=city;drawPanel();drawMap();notice('Origem: '+(places[code]?.[city]?.[0]??countries[code][0]));return}
  target=code;selected=city;regionId=null;
  loadAtlas();

  draw();
}
const active=()=>state??sample;
const origin=()=>places[active().code]?.[originIndex]??cap(active().code);
const destination=()=>currentRegion()&&atlasCountry===target?regionDestination(currentRegion()):places[target]?.[selected]??cap(target);
const getRoute=()=>quotedPlan({a:origin(),b:destination(),from:active().code,to:target,countries,preference:mode,mobility,count:Math.max(1,Math.min(active().units,units))});
const box=(label,value)=>'<div class="cell"><small>'+label+'</small><b>'+value+'</b></div>';
function draw(){
  const s=active(),c=countries[s.code],n=countries[target];
  $('date').textContent=date(s.turn);
  $('campaign').textContent=(state?flag(s.code)+' '+c[0]:'Campanha individual')+' · Cenário contemporâneo · Turno '+s.turn;
  const metrics=[['▤','PIB nominal',c[3]?money(c[3]):'—','FMI · 2025'],['◈','Orçamento',money(s.treasury),'CAIXA DISPONÍVEL'],['▥','Forças na reserva',format(s.units)+' un.','ÍNDICE SIMULADO'],['⚑','Conflitos ativos',String(Object.keys(s.wars).length),Object.keys(s.pacts).length+' ACORDO(S) COMERCIAIS']];
  $('metrics').innerHTML=metrics.map(([icon,label,value,sub],i)=>'<'+(i===1?'button id="budget" aria-label="Ajustar orçamento e mobilizar tropas"':'div')+' class="metric"><div class="icon" aria-hidden="true">'+icon+'</div><div style="text-align:left"><label>'+label+'</label><strong>'+value+'</strong><small>'+sub+'</small></div></'+(i===1?'button':'div')+'>').join('');
  $('budget').onclick=budget;
  const tax=taxReference(n), daily=world(s).nationalEconomies?.[target]?.daily??dailyTax(n);
  const war=s.wars[target],pact=s.pacts[target],conquered=s.occupied[target]?.includes(cap(target)?.[0]);
  $('nation').innerHTML='<div class="nation-title"><div class="flag">'+flag(target)+'</div><div><h2>'+safe(n[0])+'</h2><p class="nation-meta">'+safe(cap(target)?.[3]?cap(target)[0]+' · Capital':cap(target)?.[0]||n[2]||'Território')+'</p></div><span class="status '+(war?'war':'')+'">'+(war?'EM GUERRA':conquered?'OCUPADA':pact?'ACORDO':'EM PAZ')+'</span></div><div class="nation-data">'+box('PIB 2025',n[3]?money(n[3]):'Sem dado')+box('DEFESA '+(n[4]==null?'ESTIMADA':'2025'),money(annualDefense(n)))+box('FORÇA INICIAL',strength(n)+' un.')+box('RELAÇÃO',String(relation(s,target)))+box('IMPOSTOS / DIA',money(daily))+box('TAXA SOBRE PIB',tax.rate+'%'+(tax.year?' · '+tax.year:' · estimativa'))+'</div>';
  $('log').innerHTML=s.logs.length?s.logs.slice(0,8).map(l=>'<div class="line"><time>T'+l.turn+'</time><span>'+safe(l.text)+'</span></div>').join(''):'<p class="empty">O registro começa quando você assume uma nação.</p>';
  const movements=[...s.queues,...(s.transfers??[]).map(o=>({...o,city:o.destination.name,units:o.count,cargo:o.cargo}))];
  $('missions').innerHTML=movements.length?movements.map(m=>'<div class="line"><time>T'+m.eta+'</time><span><b>'+safe(m.city)+'</b> · '+MODES[m.mode].label+' · '+m.units+(m.cargo?' lotes':' un.')+'</span></div>').join(''):'<p class="empty">Nenhuma ordem em trânsito.</p>';
  drawPanel();drawMap();drawRegionalPanel();drawNews();
}
function budget(){
  if(!state)return choose();
  const w=world(state),c=countries[state.code],base=nationalBudget(c,w.economy),tax=taxReference(c);
  const price=round(Math.max(.06,annualDefense(c)/strength(c)*.15));
  modal('Orçamento nacional','<div class="form"><p>Impostos por dia <b>'+money(dailyTax(c,w.economy))+'</b> · '+tax.rate+'% do PIB '+(tax.year?'(Banco Mundial, '+tax.year+')':'(estimativa do jogo)')+'<br>Total previsto por dia <b>'+money(base)+'</b> · Caixa de defesa <b>'+money(state.treasury)+'</b></p>'+
    Object.entries(sectors).map(([id,[name]])=>'<label>'+name+' (%)<input id="budget-'+id+'" type="number" min="0" max="100" step="1" value="'+w.budget[id]+'"></label>').join('')+
    '<p id="budget-preview" class="hint"></p><button id="apply-budget" class="primary">Salvar orçamento</button><button id="recruit">Mobilizar 5 unidades · '+money(price*5)+'</button></div>');
  const inputs=Object.keys(sectors).map(id=>[id,$('budget-'+id)]);
  function show(){
    const allocation=Object.fromEntries(inputs.map(([id,input])=>[id,Number(input.value)]));
    const total=Object.values(allocation).reduce((a,b)=>a+b,0);
    $('budget-preview').textContent='Total: '+total+'% · Defesa: '+money(base*allocation.military/100)+' por turno';
    $('apply-budget').disabled=total!==100||inputs.some(([,input])=>!input.value||!input.checkValidity());
    return allocation;
  }
  inputs.forEach(([,input])=>input.oninput=show);show();
  $('apply-budget').onclick=()=>{w.budget=show();report(state,'Economia',c[0],c[0]+' aprovou novo orçamento nacional, com '+w.budget.military+'% para defesa.');$('modal').close();update()};
  $('recruit').onclick=()=>{if(state.treasury<price*5)return notice('Caixa insuficiente.');state.treasury=round(state.treasury-price*5);state.units+=5;log(state,'Cinco unidades foram mobilizadas.');$('modal').close();update()};
}
const cityOptions=(c,i)=> (places[c]??[]).map((p,j)=>'<option value="'+j+'" '+(i===j?'selected':'')+'>'+safe(p[0])+(p[3]?' ★':'')+'</option>').join('');
function movementControl(){
  return '<label>Deslocamento em terra<select id="mobility"><option value="vehicle">Comboio motorizado</option><option value="foot" '+(mobility==='foot'?'selected':'')+'>Marcha a pé</option></select></label>';
}
function bindMovement(){
  if($('mobility'))$('mobility').onchange=e=>{mobility=e.target.value;drawPanel();drawMap()};
}
function drawPanel(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='chat')return drawChat();
  if(tab==='forces')return drawForces();
  if(tab==='trade')return drawTrade();
  const s=active(),r=getRoute(),region=atlasCountry===target?currentRegion():null,available=Math.min(Math.max(1,units),s.units);
  $('panel').innerHTML='<div class="form"><div class="row2"><label>Origem<select id="origin">'+cityOptions(s.code,originIndex)+'</select></label><label>Destino<select id="destination">'+(region?'<option>'+safe(destination()[0])+'</option>':cityOptions(target,selected))+'</select></label></div><div class="row2"><label>Modalidade<select id="mode">'+Object.entries(transportLabels).map(([k,label])=>'<option value="'+k+'" '+(mode===k?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Unidades<input id="units" type="number" min="1" max="'+s.units+'" value="'+available+'"></label></div>'+movementControl()+'<div class="hint" id="route-info">'+(r?routeSummary(r):'Sem rota cadastrada nesta modalidade.')+'</div><div class="actions"><button class="primary" id="dispatch" '+(!r?.verified||s.units===0?'disabled':'')+'>Enviar ordem</button><button class="danger" id="war" '+(s.wars[target]||s.occupied[target]?.includes(cap(target)?.[0])?'disabled':'')+'>Declarar guerra</button></div></div>';
  $('origin').onchange=e=>{originIndex=Number(e.target.value);drawPanel();drawMap()};
  $('destination').onchange=e=>{selected=Number(e.target.value);drawPanel();drawMap()};
  $('mode').onchange=e=>{mode=e.target.value;drawPanel();drawMap()};
  $('units').onchange=e=>{units=Math.max(1,Math.trunc(Number(e.target.value)||1));drawPanel();drawMap()};
  bindRoadQuote(r,'route-info');bindMovement();
  $('war').onclick=()=>{
    if(!state)return choose();
    const opponent=target;
    modal('Declarar guerra','<p>As operações contra <b>'+safe(countries[opponent][0])+'</b> passam a disputar cidades. O acordo comercial, se houver, será suspenso.</p><button id="confirm-war" class="danger">Confirmar declaração</button>');
    $('confirm-war').onclick=()=>{state.wars[opponent]=true;delete state.pacts[opponent];changeRelation(state,opponent,-60);log(state,'Guerra declarada contra '+countries[opponent][0]+'.');warNews(state,opponent,countries);$('modal').close();update()};
  };
  $('dispatch').onclick=()=>{
    if(!state)return choose();
    const r=getRoute();
    if(!r?.verified)return notice('Calcule o trajeto antes de despachar.');
    const p=destination(),amount=Number($('units').value);
    if(!Number.isInteger(amount)||amount<1||amount>state.units)return notice('Informe uma quantidade válida de unidades.');
    if(state.treasury<r.cost)return notice('Caixa insuficiente para esta missão.');
    if(region?state.regions?.[region[0]]:state.occupied[target]?.includes(p[0]))return notice('Esta cidade já está sob seu controle.');
    if(state.queues.some(q=>q.to===target&&(region?q.region?.id===region[0]:!q.region&&q.city===p[0])))return notice('Já existe uma missão em trânsito para esta cidade.');
    state.treasury=round(state.treasury-r.cost);state.units-=amount;
    const territory=region?{id:region[0],name:region[1],resources:region[3]}:null;
    state.queues.push({...r,from:state.code,to:target,city:p[0],capital:p[3],population:p[4],units:amount,eta:state.turn+r.turns,region:territory});
    log(state,amount+' un. enviadas para '+p[0]+'. Chegada no turno '+(state.turn+r.turns)+'.');update();notice('Ordem registrada.');
  };
}
let gpt=false;
fetch('./api/diplomacy',{headers:{Accept:'application/json'}}).then(r=>r.ok&&r.headers.get('content-type')?.includes('application/json')?r.json():null).then(config=>{gpt=config?.enabled===true;if(tab==='chat')drawChat()}).catch(()=>{});
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
    const request=await fetch('./api/diplomacy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:countries[campaign.code][0],leader:countries[opponent][0],outcome,atWar:!!campaign.wars[opponent],relation:relation(campaign,opponent),history:history.slice(-9,-1)}),signal:AbortSignal.timeout(12000)});
    if(!request.ok)throw Error('GPT indisponível');
    const response=await request.json();if(response.text)reply.text=response.text;
    if(state===campaign)update();
  }catch{notice('Resposta das regras de campanha mantida.')}finally{pendingChat=false}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;drawPanel();drawMap()});
const palette={Europe:'#4b6574',Americas:'#445f59',Asia:'#526471',Africa:'#566057',Oceania:'#4e6170'};
const fromColor='#397e68', targetColor='#52787d', warColor='#8c494f', occupiedColor='#8d784f';
function fillCountry(code){
  const s=active(),c=countries[code];
  if(code===s.code)return fromColor;
  if(s.wars[code])return warColor;
  if(s.occupied[code]?.includes(cap(code)?.[0]))return occupiedColor;
  if(code===target)return targetColor;
  if(c[3]>0)return 'hsl(201 23% '+Math.min(46,22+Math.log10(c[3]+1)*5)+'%)';
  return palette[c[2]]??'#455862';
}
$('land').innerHTML=Object.entries(countries).filter(([,c])=>c[5]).map(([code,c])=>'<path class="country" data-code="'+code+'" d="'+c[5]+'" fill-rule="evenodd"><title>'+safe(c[0])+'</title></path>').join('');
const countryPaths=[...$('land').children];
function drawMap(){
  const s=active();
  $('route-mode').setAttribute('aria-pressed',String(pickingRoute));
  countryPaths.forEach(p=>{const c=p.dataset.code;p.style.fill=fillCountry(c);p.classList.toggle('selected',c===target);const tax=taxReference(countries[c]);p.querySelector('title').textContent=countries[c][0]+' · Impostos/dia: '+money(dailyTax(countries[c],c===s.code?world(s).economy:65))+(tax.year?'':' (estimativa)')});
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
  drawAtlas();
  drawSupply();
  const r=tab==='forces'?forceRoute():getRoute();
  const commerce=tradePartners(s.code).map(code=>[seaTrade(s.code,code),world(s).trade[code]&&!world(s).embargoes[code]&&!s.wars[code]?'tradeActive':'trade']);
  const orders=[...s.queues,...(s.transfers??[])];
  const plotted=[...commerce,...orders.flatMap(order=>(order.legs??[order]).map(leg=>[leg,false])),...(r?.verified?(r.legs??[r]).map(leg=>[leg,true]):[])];
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
    return lines.map(points=>'<polyline points="'+points.join(' ')+'" fill="none" stroke="'+(preview==='trade'?'#577d98':preview==='tradeActive'?'#61cfff':preview?({land:'#80e7bc',rail:'#ffbe69',sea:'#61cfff',air:'#dbaaef'}[path.mode]??'#80e7bc'):'#f2bd6a')+'" opacity=".94" stroke-width="'+(preview?1.8:2.3)+'" stroke-dasharray="'+(preview?'4 4':'7 3')+'" vector-effect="non-scaling-stroke" pointer-events="none"/>').join('');
  }).join('');
  $('legend').innerHTML=[[fromColor,'Sob seu comando'],[warColor,'Em guerra'],[occupiedColor,'Capitulou'],['#e6c784','Capital'],['#80e7bc','Rodovia'],['#ffbe69','Ferrovia'],['#dbaaef','Voo'],['#e9d7a6','Capital regional'],['#dbaaef','Área mineral'],['#c9a55b','Província ocupada'],['#61cfff','Comércio marítimo']].map(([color,label])=>'<span><i class="key" style="background:'+color+'"></i>'+label+'</span>').join('');
  $('mapstatus').textContent=Object.keys(countries).length+' TERRITÓRIOS · '+Object.values(places).reduce((n,p)=>n+p.length,0)+' LOCALIDADES';
  drawIslands();
  syncWorldCopies();
  updateCamera();
}
function updateCamera(){$('camera').setAttribute('transform','translate('+offset.join(' ')+') scale('+zoom+')');$('coords').textContent=zoom===1?'VISÃO GLOBAL':'ZOOM '+zoom.toFixed(1).replace('.',',')+'×'}
function setZoom(next,x=600,y=265){
  const newZoom=Math.max(1,Math.min(MAX_ZOOM,next));
  offset=[x-(x-offset[0])*newZoom/zoom,y-(y-offset[1])*newZoom/zoom];
  zoom=newZoom;clampMap();drawMap();
}
function reset(){zoom=1;offset=[0,0];updateCamera()}
$('plus').onclick=()=>setZoom(zoom*1.4);
$('minus').onclick=()=>setZoom(zoom/1.4);
$('home').onclick=()=>{reset();drawMap()};
const map=$('map');
function coordinates(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse());return [p.x,p.y]}
map.onwheel=e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.25:.8),...coordinates(e))};
const pointers=new Map();
let gesture;
function pinch(){
  const [a,b]=[...pointers.values()];
  return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],gap:Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]))};
}
function clampMap(){
    const period=WORLD_WIDTH*zoom;
  offset=[-(((-offset[0]%period)+period)%period),Math.max(530*(1-zoom),Math.min(0,offset[1]))];
}
map.onpointerdown=e=>{
  if(e.button!==0||pointers.size>=2)return;
  const point=coordinates(e);
  pointers.set(e.pointerId,point);
  map.setPointerCapture(e.pointerId);
  if(pointers.size===1)gesture={start:point,from:[...offset],clicked:e.target.closest('[data-island],[data-region],[data-code]'),moved:false};
  else gesture={...pinch(),from:[...offset],zoom,moved:true};
};
map.onpointermove=e=>{
  if(!pointers.has(e.pointerId))return;
  const point=coordinates(e);
  pointers.set(e.pointerId,point);
  if(pointers.size===2){
    const current=pinch();
    zoom=Math.max(1,Math.min(MAX_ZOOM,gesture.zoom*current.gap/gesture.gap));
    offset=gesture.from.map((v,i)=>current.center[i]-(gesture.center[i]-v)*zoom/gesture.zoom);
    clampMap();drawMap();
    return;
  }
  const [dx,dy]=point.map((v,i)=>v-gesture.start[i]);
  if(Math.hypot(dx,dy)>6)gesture.moved=true;
  if(gesture.moved){
    offset=[gesture.from[0]+dx,gesture.from[1]+dy];
    clampMap();updateCamera();
  }
};
function endPointer(e,cancelled){
  if(!pointers.delete(e.pointerId))return;
  if(pointers.size){
    gesture={start:pointers.values().next().value,from:[...offset],moved:true};
    return;
  }
  const clicked=gesture.clicked;
  if(!cancelled&&clicked&&!gesture.moved){
    if(clicked.dataset.island)selectIsland(clicked.dataset.island);
    else if(clicked.dataset.region){
      if(clicked.dataset.capital&&pickingRoute)pickCapital(clicked.dataset.region);
      else selectRegion(clicked.dataset.region);
    }
    else pickTarget(clicked.dataset.code,Number(clicked.dataset.city??0));
  }
  gesture=null;
}
map.onpointerup=e=>endPointer(e,false);
map.onpointercancel=e=>endPointer(e,true);
map.onlostpointercapture=e=>endPointer(e,true);
document.querySelectorAll('[data-mobile-tab]').forEach(link=>link.onclick=()=>{
  tab=link.dataset.mobileTab;
  drawPanel();
});
async function loadAtlas(code=target,focus=false){
  const request=++atlasRequest;
  atlasCountry=code;regionId=null;atlas=[];atlasStatus='Carregando províncias…';
  drawRegionalPanel();
  try{
    const result=await regionsFor(code,countries);
    if(request!==atlasRequest)return;
    atlas=result;seedForces(active(),code,result,strength(countries[code]));if(state)save();atlasStatus=result.length?'':'Nenhuma subdivisão disponível para este território.';
  }catch{if(request!==atlasRequest)return;atlasStatus='Atlas regional indisponível. Selecione o país novamente para tentar.'}
  draw();
  if(focus&&atlas.length&&!selectedIsland)focusAtlas();
}
function selectRegion(id){
  selectedIsland=null;$('island-select').value='';
  regionId=id||null;

  draw();
}
function drawRegionalPanel(){
  const panel=$('regional-panel');
  const region=currentRegion(),s=active();
  const options=atlas.map(r=>'<option value="'+safe(r[0])+'" '+(r[0]===regionId?'selected':'')+'>'+safe(r[1])+(r[3].length?' ◆':'')+'</option>').join('');
  const resources=region?.[3].map(site=>'<li><a href="'+safe(site[5])+'" target="_blank" rel="noopener">'+safe(site[0])+'</a> · '+safe(site[1])+' · '+money(site[4])+'/turno</li>').join('');
  const owned=Object.values(s.regions??{});
  panel.innerHTML='<div class="form"><label>País no atlas<select id="atlas-country">'+codes.map(code=>'<option value="'+code+'" '+(code===atlasCountry?'selected':'')+'>'+safe(countries[code][0])+'</option>').join('')+'</select></label><label>Estado ou província<select id="region-select"><option value="">Visão nacional</option>'+options+'</select></label>'+
    (atlasStatus?'<p class="hint">'+atlasStatus+'</p>':'')+
    (region?'<p class="hint">'+(region[2]?'Capital local · '+safe(region[2][0]):'Capital sem registro · objetivo regional')+(atlasCountry===s.code||s.regions?.[region[0]]?' · Sob seu comando':'')+'</p>':'')+
    (resources?'<ul class="deposits">'+resources+'</ul>':'')+
    '<p class="hint">'+(atlas.length?atlas.length+' subdivisões em '+safe(countries[atlasCountry][0])+' · ':'')+owned.length+' região(ões) ocupada(s) · Receita mineral simulada '+money(mineralRevenue(s))+'/turno.</p></div>';
  if(selectedIsland)drawIslandPanel(panel,s);
  $('atlas-country').onchange=e=>{selectedIsland=null;$('island-select').value='';const code=e.target.value;if(code===s.code){loadAtlas(code);draw()}else pickTarget(code)};
  $('region-select').onchange=e=>selectRegion(e.target.value);
  if(region){
    const nearby=nearbyAirports(regionDestination(region),countries[atlasCountry][1]).filter(p=>distance(regionDestination(region),p)<180);
    if(nearby.length)panel.insertAdjacentHTML('beforeend','<p class="hint force-summary">Aeroportos próximos · '+nearby.map(p=>safe(p[4])+' ('+airportSize[p[5]]+')').join(' · ')+'</p>');
    const controller=s.regions?.[region[0]]?s.code:atlasCountry;
    const stack=garrison(s,controller,region[0]);
    const summary=Object.entries(equipment).filter(([key])=>stack[key]>0).map(([key,info])=>stack[key]+' × '+info[1]).join(' · ');
    panel.insertAdjacentHTML('beforeend','<p class="hint force-summary">Guarnição · '+Object.values(stack).reduce((a,b)=>a+b,0)+' unidades · '+(summary||'Sem unidades posicionadas')+' · Suprimentos: '+stock(s,region[0])+' lotes.</p>');
  }
  panel.insertAdjacentHTML('beforeend','<div class="atlas-actions"><button id="focus-country">Centralizar país</button><button id="show-supply" aria-pressed="'+supplyVisible+'">'+(supplyVisible?'Ocultar rotas':'Ver rotas de suprimento')+'</button><button id="force-panel">Administrar forças →</button></div>');
  $('focus-country').onclick=focusAtlas;
  $('show-supply').onclick=()=>{supplyVisible=!supplyVisible;drawRegionalPanel();drawMap()};
  $('force-panel').onclick=()=>{tab='forces';drawPanel();drawMap();$('command').scrollIntoView({block:'nearest'})};
}
function drawAtlas(){
  const s=active();
  $('regions').innerHTML=atlas.map(r=>{
    const id=safe(r[0]), selected=r[0]===regionId, occupied=!!s.regions?.[r[0]];
    const marker=(lon,lat,title,kind)=>{const [x,y]=svgPoint(lon,lat);return '<circle data-region="'+id+'" class="regional-marker '+kind+'" cx="'+x+'" cy="'+y+'" r="'+(kind==='mineral'?3.4:2.4)/Math.sqrt(zoom)+'"><title>'+safe(title)+'</title></circle>'};
    const shape=r[4]?'<path data-region="'+id+'" class="region-shape '+(selected?'chosen ':'')+(occupied?'held':s.wars[atlasCountry]?'conflict':'')+'" d="'+r[4]+'"><title>'+safe(r[1])+'</title></path>':'';
    const label=r[2]&&(selected||zoom>=2.3&&atlas.length<=55)?'<text class="regional-label" x="4" y="-3">'+safe(r[2][0])+'</text>':'';
    const capital=r[2]?'<g data-capital="1" data-region="'+id+'" transform="translate('+svgPoint(r[2][1],r[2][2]).join(' ')+') scale('+1/Math.sqrt(zoom)+')"><circle class="regional-marker regional-capital" r="2.4"><title>'+safe(r[2][0])+'</title></circle>'+label+'</g>':'';
    const places=capital+r[3].map(site=>marker(site[2],site[3],site[0]+' · '+site[1],'mineral')).join('');
    return [shape,places];
  }).reduce(([shapes,markers],[shape,points])=>[shapes+shape,markers+points],['','']).join('');
}
function syncWorldCopies(){
  const tile=$('world-tile');
  for(const id of ['west-world','east-world']){
    const children=[...tile.children].map(el=>{const copy=el.cloneNode(true);copy.removeAttribute('id');return copy});
    $(id).replaceChildren(...children);
  }
}
function focusCoordinates(lon,lat,scale){
  const [x,y]=svgPoint(lon,lat);
  zoom=scale;offset=[600-x*zoom,265-y*zoom];
  clampMap();drawMap();
}
function drawIslands(){
  const s=active(),r=7/zoom;
  $('islands').innerHTML=islands.map(([id,owner,name,lon,lat,path])=>{
    const [x,y]=svgPoint(lon,lat),held=!!s.regions?.['island-'+id];
    const label=zoom>=9||selectedIsland===id;
    const shape=path?'<path class="island-land" fill="'+(held?occupiedColor:fillCountry(owner))+'" d="'+path+'"/>':'';
    return '<g data-island="'+id+'" class="island '+(held?'held':'')+(selectedIsland===id?' chosen':'')+'">'+shape+
      '<circle class="island-hit" cx="'+x+'" cy="'+y+'" r="'+r+'"/><circle class="island-dot" cx="'+x+'" cy="'+y+'" r="'+r*.47+'"/>'+
      (label?'<text class="regional-label" transform="translate('+x+' '+y+') scale('+1/zoom+')" x="8" y="-6">'+safe(name)+'</text>':'')+
      '<title>'+safe(name)+' · '+safe(countries[owner][0])+'</title></g>';
  }).join('');
}
function selectIsland(id){
  const island=islandById.get(id);
  if(!island)return;
  const [,owner,,lon,lat]=island;
  selectedIsland=id;$('island-select').value=id;
  if(owner!==active().code){target=owner;selected=0;}
  loadAtlas(owner);
  focusCoordinates(lon,lat,Math.max(zoom,32));
  drawRegionalPanel();
}
function drawIslandPanel(panel,s){
  const [id,owner,name,lon,lat]=islandById.get(selectedIsland);
  const key='island-'+id;
  const held=owner===s.code||!!s.regions?.[key],war=!!s.wars[owner];
  const base=origin();
  const km=base?Math.round(distance(base,[name,lon,lat])):0;
  const turns=Math.max(1,Math.ceil(km/430)),cost=round(.12+km/30000);
  const pending=s.queues.some(order=>order.region?.id===key);
  panel.insertAdjacentHTML('beforeend','<div class="island-detail"><h3>'+safe(name)+'</h3><p class="hint">'+(held?'Sob seu comando':'Território de '+safe(countries[owner][0]))+'</p>'+
    (held?'': '<p class="hint">Expedição simulada · '+format(km)+' km · '+turns+' turno(s) · '+money(cost)+'</p><div class="actions"><button id="island-war" '+(war?'disabled':'')+'>Declarar guerra</button><button id="island-send" class="primary" '+(!war||pending||!s.units||!base?'disabled':'')+'>Enviar expedição</button></div>')+'</div>');
  if(held)return;
  $('island-war').onclick=()=>{
    if(!state)return choose();
    modal('Declarar guerra','<p>Ocupar '+safe(name)+' exige guerra com '+safe(countries[owner][0])+'.</p><button id="island-confirm">Confirmar declaração</button>');
    $('island-confirm').onclick=()=>{
      state.wars[owner]=true;delete state.pacts[owner];changeRelation(state,owner,-60);
      warNews(state,owner,countries);log(state,'Guerra declarada contra '+countries[owner][0]+'.');$('modal').close();update();
    };
  };
  $('island-send').onclick=()=>{
    if(!state)return choose();
    modal('Expedição para '+name,'<form class="form" id="expedition"><label>Unidades da reserva<input id="expedition-units" type="number" min="1" max="'+state.units+'" value="'+Math.min(10,state.units)+'" required></label><button type="submit" class="primary">Despachar por '+money(cost)+'</button></form>');
    $('expedition').onsubmit=e=>{
      e.preventDefault();
      const count=Number($('expedition-units').value);
      if(!Number.isInteger(count)||count<1||count>state.units||state.treasury<cost)return notice('Verifique as unidades e o caixa disponíveis.');
      state.units-=count;state.treasury=round(state.treasury-cost);
      state.queues.push({mode:'sea',points:[base,[name,lon,lat]],km,eta:state.turn+turns,to:owner,city:name,units:count,region:{id:key,name,resources:[]}});
      log(state,'Expedição enviada para '+name+'.');$('modal').close();update();
    };
  };
}
$('island-select').insertAdjacentHTML('beforeend', [...islands].sort((a,b)=>a[2].localeCompare(b[2],'pt-BR')).map(([id,,name])=>'<option value="'+id+'">'+safe(name)+'</option>').join(''));
$('island-select').onchange=e=>{
  if(e.target.value)selectIsland(e.target.value);
  else{selectedIsland=null;draw()}
};
$('pacific').onclick=()=>focusCoordinates(180,-9,2.5);
function focusAtlas(){
  const shapes=[...$('regions').querySelectorAll('.region-shape')];
  const selected=shapes.find(shape=>shape.dataset.region===regionId);
  let boxes=(selected?[selected]:shapes).map(shape=>shape.getBBox()).filter(box=>box.width&&box.height);
  if(!boxes.length){const p=cap(atlasCountry);if(p&&islandOwners.has(atlasCountry))focusCoordinates(p[1],p[2],40);return;}
  if(!selected&&atlasCountry==='FRA'){
    const mainland=boxes.filter(box=>box.x>560&&box.x<650&&box.y<165);
    if(mainland.length)boxes=mainland;
  }
  const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.width));
  const top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
  zoom=Math.max(1,Math.min(MAX_ZOOM,980/Math.max(1,right-left),410/Math.max(1,bottom-top)));
  offset=[600-(left+right)/2*zoom,265-(top+bottom)/2*zoom];
  clampMap();drawMap();
}
async function loadCommandAtlas(){
  const request=++commandRequest,campaign=state, code=active().code;
  try{
    const result=await regionsFor(code,countries);
    if(request!==commandRequest||campaign!==state)return;
    commandAtlas=result;
    seedForces(active(),code,result,strength(countries[code]));
    if(state)save();
    if(tab==='forces')drawPanel();
  }catch{if(tab==='forces')notice('Não foi possível carregar suas guarnições.')}
}
const homeForces=()=>[...commandAtlas,...atlas.filter(r=>active().regions?.[r[0]]&&atlasCountry!==active().code)];
const verifiedPlans=new Map();
function quotedPlan(options){
  const key=JSON.stringify([options.a,options.b,options.from,options.to,options.kind,options.preference,options.unit,options.mobility,options.count,options.cargo,options.landPath,options.seaPath]);
  if(verifiedPlans.has(key))return verifiedPlans.get(key);
  const plan=planTransport(options);
  return plan&&{...plan,key,options:{count:options.count,unit:options.unit,mobility:options.mobility,cargo:options.cargo}};
}
function bindRoadQuote(plan,id){
  const button=$(id).querySelector('[data-road-quote]');
  if(!button)return;
  button.onclick=async()=>{
    button.disabled=true;button.textContent='Consultando as estradas…';
    try{
      verifiedPlans.set(plan.key,await verifyTransport(plan,plan.options));
      if(verifiedPlans.size>100)verifiedPlans.delete(verifiedPlans.keys().next().value);
      drawPanel();drawMap();
    }catch(error){
      button.disabled=false;button.textContent='Recalcular rota';
      button.nextElementSibling.textContent=error.message||'Falha ao consultar a rede rodoviária.';
    }
  };
}
function routeSummary(route){
  if(!route.verified)return '<button type="button" data-road-quote>Calcular pelas estradas</button><p class="hint">Confirme a ligação rodoviária para ver distância, custo e prazo.</p>';
  return format(route.km)+' km · '+route.days+' dia(s) · chegada em '+route.turns+' turno(s) · '+money(route.cost)+
    '<ol class="itinerary">'+route.legs.map(leg=>'<li>'+safe(leg.label)+' · '+safe(leg.from)+' → '+safe(leg.to)+' · '+format(Math.round(leg.km))+' km · '+leg.days.toLocaleString('pt-BR',{maximumFractionDigits:1})+' dia(s) · '+money(leg.cost)+' <small>'+safe(leg.source)+'</small></li>').join('')+'</ol>';
}
function forceRoute(){
  const a=homeForces().find(r=>r[0]===forceOrigin),b=currentRegion();
  if(!a||!b||a[0]===b[0])return null;
  const kind=cargo?'land':equipment[forceType][2],code=active().code;
  const from=commandAtlas.includes(a)?code:active().regions?.[a[0]]?.country;
  if(!from)return null;
  let landPath;
  if(from===atlasCountry){
    landPath=landSupply(atlas,linksFor(atlas),a[0],b[0],r=>from===code||r===b||!!active().regions?.[r[0]]);
  }
  const seaPath=seaSupply(a[0],b[0]);
  return quotedPlan({a:regionDestination(a),b:regionDestination(b),from,to:atlasCountry,countries,landPath,seaPath,
    preference:kind==='air'?'air':kind==='sea'?'sea':transportPreference,kind,unit:forceType,count:forceCount,cargo,mobility:cargo||forceType!=='infantry'?'vehicle':mobility});
}
function drawSupply(){
  $('supply').replaceChildren();
  if((!supplyVisible&&!currentRegion())||!atlas.length)return;
  const region=currentRegion();
  const nodes=new Map(atlas.map(r=>[r[0],r]));
  const links=linksFor(atlas).filter(({a,b})=>!region||region[0]===a||region[0]===b);
  $('supply').innerHTML=links.map(({a,b})=>{
    const points=[nodes.get(a),nodes.get(b)].map(r=>{const p=regionDestination(r);return svgPoint(p[1],p[2]).join(',')});
    return '<polyline class="supply-link" points="'+points.join(' ')+'"/>';
  }).join('');
}
function drawForces(){
  const s=active(),dest=currentRegion(),homes=homeForces();
  if(!homes.some(r=>r[0]===forceOrigin))forceOrigin=homes.find(r=>garrison(s,s.code,r[0])[forceType])?.[0]??homes[0]?.[0]??'';
  const available=cargo?stock(s,forceOrigin):(garrison(s,s.code,forceOrigin)[forceType]??0), travel=forceRoute();
  const friendly=atlasCountry===s.code||!!s.regions?.[dest?.[0]];
  const groups=['Exército','Força Aérea','Marinha'];
  $('panel').innerHTML='<div class="form"><p class="hint">Escolha o destino no mapa ou no menu Estado ou província. As guarnições são simuladas.</p>'+
    '<label>Origem da guarnição<select id="force-origin">'+homes.map(r=>'<option value="'+safe(r[0])+'" '+(r[0]===forceOrigin?'selected':'')+'>'+safe(r[1])+(portFor(r[0])?' ⚓':'')+'</option>').join('')+'</select></label>'+
    '<label>Carga<select id="force-cargo"><option value="troops">Tropas</option><option value="resources" '+(cargo?'selected':'')+'>Suprimentos</option></select></label>'+
    (cargo?'<p class="hint">Estoque na origem: '+available+' lotes.</p>':'<label>Unidade<select id="force-unit">'+groups.map(group=>'<optgroup label="'+group+'">'+Object.entries(equipment).filter(([,info])=>info[0]===group).map(([key,info])=>'<option value="'+key+'" '+(key===forceType?'selected':'')+'>'+info[1]+' · '+(garrison(s,s.code,forceOrigin)[key]??0)+'</option>').join('')+'</optgroup>').join('')+'</select></label>')+
    (cargo||equipment[forceType][2]==='land'?'<label>Transporte<select id="transport-pref">'+Object.entries(transportLabels).map(([id,label])=>'<option value="'+id+'" '+(id===transportPreference?'selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+
    (!cargo&&forceType==='infantry'?movementControl():'')+
    '<label>Quantidade<input id="force-count"  type="number" min="1" value="'+forceCount+'"></label>'+
    '<p class="hint">'+(dest?'Destino · '+safe(dest[1])+(dest[2]?' · '+safe(dest[2][0]):''):'Selecione um destino regional.')+'</p>'+
    '<div class="hint" id="force-route">'+(travel?routeSummary(travel):dest?'Sem rota cadastrada para esta combinação.':'')+'</div>'+
    '<button id="force-send" class="primary" '+(!travel?.verified||!available||!state||!friendly&&(cargo||!s.wars[atlasCountry])?'disabled':'')+'>'+(cargo?'Enviar suprimentos':friendly?'Enviar reforço':'Atacar província')+'</button>'+
    (!friendly&&dest&&!s.wars[atlasCountry]?'<p class="hint">Declare guerra ao país na aba Operações para atacar.</p>':'')+
    '<button id="force-recruit" '+(!state||!forceOrigin||!cargo&&equipment[forceType][2]==='sea'&&!portFor(forceOrigin)?'disabled':'')+'>'+(cargo?'Comprar 10 lotes · '+money(.1):'Mobilizar 1 unidade · '+money(equipment[forceType][4]))+'</button></div>';
  bindRoadQuote(travel,'force-route');bindMovement();
  if($('transport-pref'))$('transport-pref').onchange=e=>{transportPreference=e.target.value;drawForces();drawMap()};
  $('force-origin').onchange=e=>{forceOrigin=e.target.value;drawForces();drawMap()};
  $('force-cargo').onchange=e=>{cargo=e.target.value==='resources';drawForces();drawMap()};
  if($('force-unit'))$('force-unit').onchange=e=>{forceType=e.target.value;drawForces();drawMap()};
  $('force-count').onchange=e=>{forceCount=Math.max(1,Math.trunc(Number(e.target.value)||1));drawForces();drawMap()};
  $('force-recruit').onclick=()=>{
    const cost=cargo ? .1 : equipment[forceType][4];
    if(state.treasury<cost)return notice('Caixa insuficiente.');
    state.treasury=round(state.treasury-cost);
    if(cargo){addStock(state,forceOrigin,10);update();return}
    changeGarrison(state,state.code,forceOrigin,forceType,1);
    log(state,'Mobilização: '+equipment[forceType][1]+'.');update();
  };
  $('force-send').onclick=()=>{
    if(!travel?.verified)return notice('Calcule o trajeto antes de despachar.');
    if(forceCount>available)return notice('A guarnição não tem unidades suficientes.');
    if(state.treasury<travel.cost)return notice('Caixa insuficiente.');
    state.treasury=round(state.treasury-travel.cost);
    if(cargo)addStock(state,forceOrigin,-forceCount);
    else changeGarrison(state,state.code,forceOrigin,forceType,-forceCount);
    (state.transfers??=[]).push({...travel,to:atlasCountry,origin:forceOrigin,unit:forceType,cargo,count:forceCount,eta:state.turn+travel.turns,destination:{id:dest[0],name:dest[1],resources:dest[3]}});
    log(state,'Ordem para '+dest[1]+' · '+forceCount+(cargo?' lotes de suprimento':' × '+equipment[forceType][1])+'.');
    update();
  };
}
function pickCapital(id){
  const region=atlas.find(r=>r[0]===id);
  if(!region)return;
  if(!originPicked){
    if(atlasCountry!==active().code&&!active().regions?.[id])return notice('Escolha uma capital sob seu controle.');
    forceOrigin=id;originPicked=true;regionId=id;tab='forces';draw();
    notice('Agora clique na capital de destino.');
    return;
  }
  if(id===forceOrigin)return notice('Escolha uma capital diferente para o destino.');
  pickingRoute=false;originPicked=false;tab='forces';selectRegion(id);
  $('command').scrollIntoView({block:'nearest'});
}
$('route-mode').onclick=()=>{
  pickingRoute=!pickingRoute;originPicked=false;drawMap();
  if(pickingRoute)notice('Clique primeiro na capital de origem sob seu controle.');
};
function drawNews(){
  const w=world(active()),filter=$('news-filter').value;
  const headlines=w.press.filter(n=>!filter||filter===n.category).slice(0,18);
  $('news-feed').innerHTML='<div class="world-indicators">'+[['Popularidade',w.approval],['Saúde',w.health],['Educação',w.education],['Ciência',w.science],['Economia',w.economy]].map(([label,value])=>box(label,Math.round(value)+'%')).join('')+'</div>'+
    (headlines.length?headlines.map(n=>'<div class="line"><time>T'+n.turn+'</time><span><b>'+safe(n.category)+' · '+safe(n.source)+'</b><br>'+safe(n.text)+'</span></div>').join(''):'<p class="empty">Nenhuma notícia nesta categoria.</p>');
}
$('news-filter').onchange=drawNews;
function drawTrade(){
  const s=active(),w=world(s),partner=countries[target],lane=seaTrade(s.code,target);
  const border=refugeeCorridors[s.code]?.includes(target)||refugeeCorridors[target]?.includes(s.code);
  const options=codes.filter(c=>c!==s.code).map(c=>'<option value="'+c+'" '+(c===target?'selected':'')+'>'+safe(countries[c][0])+'</option>').join('');
  $('panel').innerHTML='<div class="form"><label>Parceiro comercial<select id="trade-country">'+options+'</select></label><p class="hint">'+(lane?safe(lane.name)+' · '+format(lane.km)+' km · '+money(tradeValue(countries[s.code],partner))+'/turno':'Sem rota marítima cadastrada.')+'</p>'+
    '<button id="trade-deal" '+(!lane||s.wars[target]||w.embargoes[target]?'disabled':'')+'>'+(w.trade[target]?'Encerrar rota comercial':'Ativar rota comercial')+'</button>'+
    '<button id="embargo">'+(w.embargoes[target]?'Suspender embargo':'Impor embargo')+'</button>'+
    '<button id="border" '+(!border?'disabled':'')+'>'+(w.borders[target]?'Reabrir fronteira civil':'Fechar fronteira civil')+'</button>'+
    '<p class="hint">Pessoas acolhidas no seu país: '+format(w.received[s.code]??0)+'.</p></div>';
  $('trade-country').onchange=e=>pickTarget(e.target.value);
  $('trade-deal').onclick=()=>{
    if(!state)return choose();
    if(w.trade[target])delete w.trade[target];else w.trade[target]=true;
    report(state,'Economia',partner[0],'Rota comercial '+(w.trade[target]?'ativada':'encerrada')+' entre '+countries[s.code][0]+' e '+partner[0]+'.');update();
  };
  $('embargo').onclick=()=>{if(!state)return choose();setEmbargo(state,target,countries);update()};
  $('border').onclick=()=>{if(!state)return choose();setBorder(state,target,countries);update()};
}
draw();
loadCommandAtlas();
loadAtlas(active().code,true);
if(!state)choose();
