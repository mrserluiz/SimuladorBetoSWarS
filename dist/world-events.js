import {taxRates} from './tax-data.js';
export const sectors={
  military:['Defesa',19], education:['Educação',19], health:['Saúde',24],
  policy:['Políticas públicas',24], science:['Ciência e tecnologia',14]
};
export const DEFAULT_ALLOCATION=Object.fromEntries(Object.entries(sectors).map(([k,v])=>[k,v[1]]));
export const clamp=(value,low=0,high=100)=>Math.max(low,Math.min(high,value));
export function taxReference(country){
  const [rate,year]=taxRates[country[1]]??[18,null];
  return {rate,year};
}
export const dailyTax=(country,economy=65)=>country[3]*taxReference(country).rate/100/365*(.75+economy/260);
export const nationalBudget=(country,economy)=>dailyTax(country,economy);
export const refugeeCorridors={
  BRA:['ARG','URY','PRY','BOL','PER','COL'], ARG:['URY','CHL','PRY','BOL','BRA'],
  URY:['BRA','ARG'], PRY:['BRA','ARG','BOL'], BOL:['PER','BRA','PRY','ARG','CHL'],
  USA:['CAN','MEX'], CAN:['USA'], MEX:['USA','GTM','BLZ'],
  UKR:['POL','ROU','MDA','SVK','HUN'], POL:['DEU','CZE','SVK','LTU','UKR'],
  FRA:['BEL','ESP','DEU','CHE','ITA'], DEU:['POL','FRA','CZE','AUT','NLD','BEL','DNK'],
  CHN:['MNG','KAZ','VNM','LAO','PAK','IND'], IND:['NPL','BGD','BTN','PAK'],
  RUS:['FIN','NOR','EST','LVA','GEO','KAZ','MNG'], JPN:['KOR'], GBR:['IRL','FRA']
};
export function world(state){
  return state.world??={budget:{...DEFAULT_ALLOCATION},approval:62,health:68,education:61,science:48,economy:65,embargoes:{},borders:{},press:[],displacement:{},received:{},stranded:{},crises:{},trade:{},finance:{}};
}
export function report(state,category,source,text){
  const w=world(state);
  w.press.unshift({turn:state.turn,category,source,text});
  w.press.length=Math.min(w.press.length,100);
}
export function maritimeIncome(state,countries,route){
  const w=world(state);
  return Object.keys(w.trade).reduce((sum,code)=>{
    if(state.wars[code]||w.embargoes[code]||!route(state.code,code))return sum;
    return sum+tradeValue(countries[state.code],countries[code]);
  },0);
}
export const tradeValue=(a,b)=>Math.max(.015,Math.min(.7,Math.sqrt(a[3]*b[3])*.000065));
export function setEmbargo(state,code,countries){
  const w=world(state),enable=!w.embargoes[code];
  if(enable)w.embargoes[code]=true;
  else delete w.embargoes[code];
  report(state,'Economia',countries[code][0],countries[state.code][0]+(enable?' impôs um embargo comercial a ':' suspendeu o embargo contra ')+countries[code][0]+'.');
}
export function setBorder(state,code,countries){
  const w=world(state),close=!w.borders[code];
  if(close)w.borders[code]=true;
  else delete w.borders[code];
  report(state,'Fronteiras',countries[code][0],countries[state.code][0]+(close?' fechou a fronteira para travessias civis com ':' reabriu a fronteira para travessias civis com ')+countries[code][0]+'.');
}
function relocate(state,origin,amount,countries){
  const w=world(state);
  if(!amount)return;
  const candidates=(refugeeCorridors[origin]??[]).filter(code=>countries[code]);
  const receiver=candidates.find(code=>{
    if(state.wars[code]||state.wars[origin]&&code===state.code)return false;
    return !((origin===state.code&&w.borders[code])||(code===state.code&&w.borders[origin]));
  });
  if(!receiver){
    w.stranded[origin]=(w.stranded[origin]??0)+amount;
    report(state,'Migração',countries[origin][0],amount.toLocaleString('pt-BR')+' pessoas deixaram suas casas em '+countries[origin][0]+' e aguardam um corredor de acolhimento.');
    return;
  }
  w.received[receiver]=(w.received[receiver]??0)+amount;
  report(state,'Migração',countries[receiver][0],countries[receiver][0]+' informa ter recebido '+amount.toLocaleString('pt-BR')+' pessoas deslocadas de '+countries[origin][0]+'.');
}
export function warNews(state,opponent,countries){
  const w=world(state),name=countries[opponent][0];
  report(state,'Guerra',name,countries[state.code][0]+' declarou guerra a '+name+'. O comércio bilateral foi suspenso.');
  w.displacement[opponent]=(w.displacement[opponent]??0)+1;
  relocate(state,opponent,1400,countries);
}
export function advanceWorld(state,countries,route){
  const w=world(state),own=countries[state.code],p=w.budget;
  const trade=maritimeIncome(state,countries,route);
  const war=Object.keys(state.wars).length;
  const priorHealth=w.health,priorEconomy=w.economy;
  const reception=Math.min(2,(w.received[state.code]??0)/15000);
  w.health=clamp(w.health+((p.health-22)*.24+(p.policy-20)*.06-war*.45-reception)/7);
  w.education=clamp(w.education+((p.education-17)*.23)/7);
  w.science=clamp(w.science+((p.science-12)*.29+(p.education-17)*.06)/7);
  w.economy=clamp(w.economy+((p.science-12)*.1+(p.policy-20)*.09+trade*2-war*.5-Object.keys(w.embargoes).length*.16)/7);
  w.approval=clamp(w.approval+((p.policy-20)*.18+(w.health-priorHealth)*.28+(w.economy-priorEconomy)*.5-war*.3)/7);
  const previousEconomies=w.nationalEconomies??{};
  w.nationalEconomies=Object.fromEntries(Object.entries(countries).map(([code,country])=>{
    const previous=previousEconomies[code], ownNation=code===state.code;
    const daily=dailyTax(country,ownNation?w.economy:state.wars[code]?57:65);
    return [code,{daily,total:(previous?.total??0)+daily}];
  }));
  const nextBudget=w.nationalEconomies[state.code].daily;
  w.finance={daily:nextBudget,taxes:nextBudget,total:w.nationalEconomies[state.code].total,civil:nextBudget*(100-p.military)/100,military:nextBudget*p.military/100,trade};
  if(w.health<48&&!w.crises.health){
    w.crises.health=true;report(state,'Saúde pública',own[0],'A rede de saúde de '+own[0]+' entrou em alerta por queda da capacidade de atendimento.');
  }else if(w.health>=55&&w.crises.health){
    delete w.crises.health;report(state,'Saúde pública',own[0],own[0]+' saiu do alerta após recuperar capacidade de atendimento.');
  }
  if(w.economy<48&&!w.crises.economy){
    w.crises.economy=true;report(state,'Economia',own[0],own[0]+' registra contração no cenário simulado.');
  }else if(w.economy>=55&&w.crises.economy){
    delete w.crises.economy;report(state,'Economia',own[0],own[0]+' anunciou recuperação da atividade econômica.');
  }
  if((state.turn-1)%21===0){
    for(const code of Object.keys(state.wars)){
      const wave=(w.displacement[code]??0)+1;
      w.displacement[code]=wave;
      relocate(state,code,1400+wave*320,countries);
    }
  }
  if((state.turn-1)%28===0){
    const reporters=[...new Set(Object.keys(countries).filter(code=>code!==state.code&&countries[code][3]>0))].sort();
    if(reporters.length){
      const code=reporters[(state.turn*13)%reporters.length],name=countries[code][0];
      const category=(state.turn-1)%56===0?'Saúde pública':'Economia';
      report(state,category,name,category==='Economia'?name+' divulga seu boletim de comércio e acompanha as rotas abertas no cenário.':name+' divulga um boletim de vigilância sanitária em portos e fronteiras.');
    }
  }
  return {military:w.finance.military,trade};
}
