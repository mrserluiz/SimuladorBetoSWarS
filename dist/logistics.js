import {verifyRoad} from './roads.js';
import {airports} from './transport-data.js';
import {distance,route} from './engine.js';
import {ports,maritimeEdges} from './maritime-data.js';

const specs={
  land:{label:'Rodovia',speed:650,rate:.00011,base:.006,load:0},
  sea:{label:'Navegação',speed:3000,rate:.000035,base:.026,load:.8},
  air:{label:'Voo',speed:11000,rate:.00018,base:.032,load:.35}
};
export const transportLabels={auto:'Automático · menor custo',land:'Só terrestre',sea:'Embarque marítimo',air:'Transporte aéreo'};
const maxAirRange=5600;
const transportLoad={infantry:1,armor:3,tank:6,fighter:2,transport:3,corvette:3,submarine:4,cruiser:6,carrier:8};
const almostSame=(a,b)=>distance(a,b)<1;
const pointsKm=points=>points.slice(1).reduce((km,p,i)=>km+distance(points[i],p),0);
const name=p=>p[4]&&typeof p[4]==='string'?p[4]:p[0];
const roadDistance=(a,b)=>Math.max(1,distance(a,b)*1.22);

function roadLeg(a,b){
  return {mode:'land',points:[a,b],km:roadDistance(a,b),source:'Aguardando traçado rodoviário'};
}
function roadLegs(points){
  return [{mode:'land',points,km:pointsKm(points)*1.22,source:'Aguardando traçado rodoviário'}];
}
function shortest(start,finish,neighbors,weight){
  const scores=new Map([[start,0]]),previous=new Map(),visited=new Set();
  while(true){
    let next,best=Infinity;
    for(const [id,score] of scores)if(!visited.has(id)&&score<best){next=id;best=score}
    if(next===undefined)return null;
    if(next===finish){
      const path=[];
      for(let id=finish;id!==undefined;id=previous.get(id))path.unshift(id);
      return path;
    }
    visited.add(next);
    for(const item of neighbors(next)){
      const score=best+weight(next,item);
      if(score<(scores.get(item)??Infinity)){scores.set(item,score);previous.set(item,next)}
    }
  }
}
function airportLegs(a,b,from,to,countries){
  const nearest=(point,country)=>{
    const candidates=airports.filter(p=>p[3]===countries[country][1]).sort((x,y)=>distance(point,x)-distance(point,y));
    const airport=candidates[0];
    return airport&&distance(point,airport)<900?airport:null;
  };
  const first=nearest(a,from),last=nearest(b,to);
  if(!first||!last||first===last)return null;
  const path=shortest(first,last,p=>airports.filter(q=>p!==q&&distance(p,q)<=maxAirRange),(p,q)=>distance(p,q)+550);
  if(!path)return null;
  return [...(almostSame(a,first)?[]:[roadLeg(a,first)]),
    ...path.slice(1).map((p,i)=>({mode:'air',points:[path[i],p],km:distance(path[i],p),source:'OurAirports · escala simulada'})),
    ...(almostSame(last,b)?[]:[roadLeg(last,b)])];
}
function seaLegs(a,b,from,to,regionalSea,naval){
  if(regionalSea){
    const first=regionalSea[0],last=regionalSea.at(-1);
    return [...(!naval&&!almostSame(a,first)?[roadLeg(a,first)]:[]),{mode:'sea',points:regionalSea,km:pointsKm(regionalSea),source:'Corredor costeiro cadastrado'},...(!naval&&!almostSame(last,b)?[roadLeg(last,b)]:[])];
  }
  if(naval||from===to)return null;
  const path=shortest(from,to,code=>Object.keys(ports).filter(other=>maritimeEdges[[code,other].sort().join('/')]),
    (x,y)=>maritimeEdges[[x,y].sort().join('/')][0]+125);
  if(!path)return null;
  const legs=path.slice(1).map((dest,i)=>{
    const start=path[i];
    const [km,geometry]=maritimeEdges[[start,dest].sort().join('/')];
    return {mode:'sea',points:[ports[start],...(start<dest?geometry:[...geometry].reverse()).map(([x,y])=>['',x,y]),ports[dest]],km,source:'SeaRoute · rede marítima'};
  });
  return [roadLeg(a,ports[from]),...legs,roadLeg(ports[to],b)];
}

function totalPlan(legs,count,unit,cargo){
  const load=count*(cargo ? .35 : (transportLoad[unit]??1));
  const breakdown=legs.map(leg=>{
    const s=specs[leg.mode];
    return {...leg,label:s.label,from:name(leg.points[0]),to:name(leg.points.at(-1)),cost:s.base+leg.km*s.rate*(.18+load*.025),
      days:(leg.hours===undefined?leg.km/s.speed*7:Math.max(leg.km/320,leg.hours/8))+s.load+(leg.mode==='sea'?Math.floor(load/50)*.5:leg.mode==='air'?Math.floor(load/18)*.25:0)};
  });
  const km=Math.round(breakdown.reduce((n,p)=>n+p.km,0));
  const days=Math.max(1,Math.ceil(breakdown.reduce((n,p)=>n+p.days,0)));
  const cost=Math.max(.01,Math.ceil(breakdown.reduce((n,p)=>n+p.cost,0)*100)/100);
  const mode=legs.some(l=>l.mode==='air')?'air':legs.some(l=>l.mode==='sea')?'sea':'land';
  const points=legs.flatMap(l=>l.points);
  return {mode,km,days,turns:days,verified:legs.every(l=>l.mode!=='land'||l.hours!==undefined),cost,points,legs:breakdown,name:breakdown[0].from+' → '+breakdown.at(-1).to};
}

export function planTransport({a,b,from,to,countries,preference='auto',landPath,seaPath,kind='land',unit='infantry',count=1,cargo=false}){
  if(!a||!b||almostSame(a,b)||!Number.isInteger(count)||count<1)return null;
  const candidates=[];
  if((kind==='land'||cargo)&&(preference==='auto'||preference==='land')){
    const points=landPath??(from!==to?route(from,to,a,b,'land')?.points:null);
    if(points?.length>1)candidates.push(roadLegs(points));
  }
  if((kind!=='air'||cargo)&&(preference==='auto'||preference==='sea')){
    const path=seaLegs(a,b,from,to,seaPath,kind==='sea'&&!cargo);
    if(path?.length)candidates.push(path);
  }
  if((kind!=='sea'||cargo)&&(preference==='auto'||preference==='air')){
    const path=airportLegs(a,b,from,to,countries);
    if(path?.length)candidates.push(path);
  }
  return candidates.map(legs=>totalPlan(legs,count,unit,cargo)).sort((x,y)=>x.cost-y.cost||x.days-y.days)[0]??null;
}

export async function verifyTransport(plan,{count=1,unit='infantry',cargo=false}={}){
  const legs=[];
  for(const leg of plan.legs){
    if(leg.mode!=='land'){legs.push(leg);continue}
    if(almostSame(leg.points[0],leg.points.at(-1)))continue;
    const road=await verifyRoad(leg.points);
    legs.push({...leg,...road,source:'OpenStreetMap · OSRM'});
  }
  if(!legs.length)throw Error('Origem e destino estão no mesmo ponto.');
  return totalPlan(legs,count,unit,cargo);
}
