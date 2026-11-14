export const MODES = {
  land: {label:'Terrestre', speed:800, rate:.12},
  air: {label:'Aérea', speed:3200, rate:.28},
  sea: {label:'Marítima', speed:1800, rate:.18}
};
const radians = d => d * Math.PI / 180;
export function distance(a,b) {
  const lat = radians(b[2]-a[2]), lon = radians(b[1]-a[1]);
  const h = Math.sin(lat/2)**2 + Math.cos(radians(a[2]))*Math.cos(radians(b[2]))*Math.sin(lon/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,h)));
}
const corridors = [
  ['BRA','ARG','Uruguaiana–Paso de los Libres',[-57.1,-29.76]],
  ['BRA','URY','Santana do Livramento–Rivera',[-55.54,-30.89]],
  ['BRA','PRY','Ponte da Amizade',[-54.6,-25.51]],
  ['ARG','CHL','Paso Los Libertadores',[-70.07,-32.83]],
  ['ARG','URY','Ponte General San Martín',[-58.25,-33.11]],
  ['USA','CAN','Ambassador Bridge',[-83.07,42.31]],
  ['USA','MEX','San Ysidro–Tijuana',[-117.03,32.54]],
  ['FRA','DEU','Estrasburgo–Kehl',[7.80,48.57]],
  ['ESP','FRA','La Jonquera–Le Perthus',[2.85,42.46]],
  ['ESP','PRT','Badajoz–Elvas',[-7.02,38.88]],
  ['DEU','POL','Frankfurt (Oder)–Słubice',[14.55,52.35]],
  ['POL','UKR','Dorohusk–Yahodyn',[23.82,51.17]],
  ['CHN','RUS','Manzhouli–Zabaykalsk',[117.46,49.63]],
  ['CHN','PAK','Passo de Khunjerab',[75.43,36.85]],
  ['IND','PAK','Attari–Wagah',[74.6,31.6]],
  ['FRA','ITA','Túnel do Mont Blanc',[6.86,45.87]]
];
const ports = {
  BRA:['Santos',-46.30,-23.96], ARG:['Buenos Aires',-58.35,-34.60],
  URY:['Montevidéu',-56.21,-34.9], USA:['Nova York',-74.07,40.65],
  CAN:['Halifax',-63.55,44.65], MEX:['Veracruz',-96.13,19.21],
  GBR:['Southampton',-1.40,50.89], FRA:['Le Havre',.12,49.48],
  DEU:['Hamburgo',9.95,53.53], PRT:['Lisboa',-9.09,38.72],
  ESP:['Algeciras',-5.43,36.13], CHN:['Xangai',121.89,30.62],
  JPN:['Yokohama',139.67,35.45], KOR:['Busan',129.06,35.1],
  IND:['Mumbai',72.85,18.94], AUS:['Sydney',151.23,-33.86],
  ZAF:['Cidade do Cabo',18.44,-33.9]
};
const seaLanes = [
  ['BRA','ARG',[[-45,-26],[-51,-34]]],['BRA','URY',[[-45,-26],[-50,-33.3]]],
  ['ARG','URY',[]],['BRA','USA',[[-37,-15],[-34,-4],[-51,11],[-66,26],[-73,38]]],
  ['USA','CAN',[[-71,40],[-66,42]]],['USA','GBR',[[-71,40],[-45,47],[-14,49],[-5,49.6]]],
  ['GBR','FRA',[[-.9,50.5]]],['GBR','DEU',[[1.7,51.2],[4,53],[8.1,54.1]]],
  ['FRA','PRT',[[-5.5,48],[-9.5,44],[-10,39]]],['PRT','ESP',[[-9.6,37],[-7,35.9]]],
  ['CHN','JPN',[[125,30],[132,31],[139,33]]],['CHN','KOR',[[124.5,32.7],[128,34.3]]],
  ['JPN','KOR',[[139,33],[132,31],[129,33]]],['IND','ZAF',[[67,12],[53,-8],[42,-19],[36,-28],[22,-36]]],
  ['AUS','JPN',[[155,-27],[161,-11],[155,10],[146,26]]]
];
const edge = (list,a,b) => list.find(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
export function route(from,to,origin,destination,mode) {
  const target = MODES[mode];
  if (!target || !origin || !destination || from===to) return null;
  let points = [origin,destination], name = 'Corredor aéreo simulado';
  if (mode==='land') {
    const crossing = edge(corridors,from,to);
    if (!crossing) return null;
    points = [origin,[crossing[2],...crossing[3]],destination];
    name = crossing[2];
  }
  if (mode==='sea') {
    const lane = edge(seaLanes,from,to);
    if (!lane) return null;
    const waypoints = lane[0]===from ? lane[2] : [...lane[2]].reverse();
    points = [origin,ports[from],...waypoints.map(p=>['',...p]),ports[to],destination];
    points = points.filter((p,i)=>i===0 || distance(points[i-1],p)>.1);
    name = ports[from][0]+' → '+ports[to][0];
  }
  const km = Math.round(points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0));
  return {mode, name, points, km, turns:Math.max(1,Math.ceil(km/target.speed)), cost:+(target.rate+km/24000).toFixed(2)};
}
export const annualDefense = country => country[4] ?? Math.max(.01,country[3]*.017);
export const strength = country => Math.max(3,Math.round(10*Math.pow(annualDefense(country),.48)+2*Math.pow(country[3],.35)));
export const round = n => +n.toFixed(2);
export function newCampaign(code,countries) {
  const budget = annualDefense(countries[code]);
  return {code,turn:1,treasury:round(Math.max(.25,budget*.15)),funding:100,units:strength(countries[code]),relations:{},wars:{},pacts:{},occupied:{},queues:[],logs:[],chats:{}};
}
export function log(state,text) {
  state.logs.unshift({turn:state.turn,text});
  state.logs.length=Math.min(state.logs.length,65);
}
export function relation(state,code){return state.relations[code]??0}
export function changeRelation(state,code,n){state.relations[code]=Math.max(-100,Math.min(100,relation(state,code)+n))}
export const weeklyFunds = (state,country) => annualDefense(country)/52*state.funding/100;
export function advance(state,countries) {
  state.turn++;
  const country=countries[state.code];
  const income=weeklyFunds(state,country)+Object.keys(state.pacts).length*.015+Object.keys(state.occupied).length*.025;
  const maintenance=state.units*.0015+Object.keys(state.wars).length*.025;
  state.treasury=round(Math.max(0,state.treasury+income-maintenance));
  if (state.treasury===0 && income<maintenance && state.units>0) {
    state.units--;
    log(state,'Caixa insuficiente para manutenção. Uma unidade foi desmobilizada.');
  }
  const arrived=state.queues.filter(m=>m.eta<=state.turn);
  state.queues=state.queues.filter(m=>m.eta>state.turn);
  for (const m of arrived) {
    const other=countries[m.to];
    if (!state.wars[m.to]) {
      state.units+=m.units;
      log(state,'Missão em '+m.city+' concluída. As unidades voltaram à reserva.');
      continue;
    }
    const population = m.population||1;
    const defense=Math.max(2,Math.round(strength(other)*(m.capital?.33:.20)+Math.log10(population)/2-(state.occupied[m.to]?.length||0)*2));
    const attack=m.units*({land:1,air:.87,sea:.92}[m.mode]);
    const won=attack>=defense;
    const losses=Math.min(m.units,Math.max(1,Math.round(won?defense*.27:m.units*.55)));
    state.units+=m.units-losses;
    if(won) {
      (state.occupied[m.to]??=[]).push(m.city);
      if(m.capital) {
        delete state.wars[m.to];
        log(state,m.city+' foi ocupada. '+other[0]+' capitulou no cenário. Baixas: '+losses+'.');
      } else log(state,m.city+' foi ocupada. Baixas: '+losses+'.');
    } else {
      log(state,'Ataque repelido em '+m.city+'. Defesa: '+defense+' · Baixas: '+losses+'.');
    }
  }
  if (state.turn%3!==0) return;
  for (const code of Object.keys(state.wars)) {
    const strengthRatio=strength(countries[code])/Math.max(1,strength(country));
    if (strengthRatio<.65 || state.units===0) continue;
    const loss=Math.min(state.units,Math.max(1,Math.round(strengthRatio)));
    state.units-=loss;
    log(state,countries[code][0]+' realizou uma contraofensiva. Sua reserva perdeu '+loss+' un.');
  }
}
export function negotiate(state,code,proposal,countries){
  const country=countries[code], ties=relation(state,code);
  if(proposal==='trade'){
    if(state.wars[code]||ties<0) return 'Nossa delegação suspende a negociação comercial enquanto persistir a tensão bilateral.';
    if(state.pacts[code]) return 'Nosso acordo comercial já está em vigor.';
    state.pacts[code]=true; changeRelation(state,code,12);
    log(state,'Acordo comercial com '+country[0]+'. Receita adicional de US$ 0,015 bi por turno.');
    return 'Aceitamos o acordo comercial. A comissão conjunta começa a operar no próximo turno.';
  }
  if (proposal==='peace'){
    if(!state.wars[code]) return 'Nossos governos estão em paz. Podemos discutir cooperação comercial.';
    if(ties < -45 && !state.occupied[code]?.length) {changeRelation(state,code,12);return 'Ainda não aceitamos o cessar-fogo. A proposta reduziu a tensão e pode ser apresentada novamente.'}
    delete state.wars[code]; changeRelation(state,code,35);
    log(state,'Cessar-fogo com '+country[0]+'. As operações em trânsito serão concluídas sem combate.');
    return 'Aceitamos o cessar-fogo. Nossas forças receberam ordem de interromper as hostilidades.';
  }
  if(proposal==='threat'){
    changeRelation(state,code,-18);
    return 'Recebemos sua advertência. Nosso governo reforçará a vigilância e reavaliará a relação bilateral.';
  }
  changeRelation(state,code,3);
  return 'Recebemos sua mensagem. '+(state.wars[code]?'Podemos abrir negociações para um cessar-fogo.':'Estamos disponíveis para negociar comércio ou reduzir tensões.');
}
