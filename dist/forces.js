import {regionDestination} from './regions.js';

export const equipment={
  infantry:['Exército','Infantaria','land',1,.012],
  tank:['Exército','Tanques','land',3,.055],
  armor:['Exército','Carros blindados','land',2,.032],
  fighter:['Força Aérea','Aeronaves de combate','air',4,.11],
  transport:['Força Aérea','Aeronaves de transporte','air',1,.07],
  corvette:['Marinha','Corvetas','sea',3,.13],
  submarine:['Marinha','Submarinos','sea',5,.2],
  cruiser:['Marinha','Cruzadores','sea',7,.32],
  carrier:['Marinha','Porta-aviões','sea',10,.65]
};
const harbors={
  'BRA-627':['Rio de Janeiro',-43.17,-22.89],
  'BRA-1311':['Santos',-46.3,-23.96],
  'BRA-1313':['Recife',-34.87,-8.06],
  'USA-3521':['San Diego',-117.16,32.68],
  'USA-3559':['Nova York',-74.07,40.65],
  'ARG-5493':['Buenos Aires',-58.35,-34.60],
  'CAN-685':['Halifax',-63.55,44.65],
  'CHN-1819':['Xangai',121.89,30.62],
  'JPN-1860':['Tóquio',139.77,35.64],
  'GBR-2035':['Southampton',-1.4,50.89]
};
const portLinks=[
  ['BRA-627','BRA-1311'],['BRA-627','BRA-1313'],['BRA-1311','ARG-5493'],
  ['USA-3559','CAN-685'],['USA-3559','GBR-2035'],['CHN-1819','JPN-1860']
];
const shippingWaypoints={
  'BRA-627/BRA-1311':[['Ao largo da Costa Verde',-44.6,-23.65]],
  'BRA-627/BRA-1313':[['Ao largo do Espírito Santo',-39.3,-20.3],['Ao largo da Bahia',-36.7,-13.4]],
  'BRA-1311/ARG-5493':[['Ao largo do Sul',-49,-30],['Atlântico Sul',-53,-35]],
  'USA-3559/CAN-685':[['Atlântico Noroeste',-67,41.8]],
  'USA-3559/GBR-2035':[['Atlântico Norte',-44,46],['Canal da Mancha',-5,49.5]],
  'CHN-1819/JPN-1860':[['Mar da China Oriental',126,30],['Pacífico',137,32.5]]
};
export const portFor=id=>harbors[id];
export const orderTravel=(mode,points,distance)=>{
  const km=Math.round(points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0));
  return {mode,points,km,turns:Math.max(1,Math.ceil(km/({land:650,air:2600,sea:1600}[mode])))};
};

export function regionalLinks(regions,distance){
  const land=regions.filter(r=>r[4]);
  const points=new Map();
  for(const region of land)for(const point of new Set(region[4].match(/[0-9.]+,[0-9.]+/g)??[])){
    const owners=points.get(point)??[];
    owners.push(region[0]);points.set(point,owners);
  }
  const overlaps=new Map();
  for(const owners of points.values())for(let i=0;i<owners.length;i++)for(let j=i+1;j<owners.length;j++){
    const key=[owners[i],owners[j]].sort().join('/');
    overlaps.set(key,(overlaps.get(key)??0)+1);
  }
  const nodes=new Map(land.map(r=>[r[0],r]));
  return [...overlaps].filter(([,count])=>count>=2).map(([key])=>{
    const [a,b]=key.split('/');
    return {a,b,km:distance(regionDestination(nodes.get(a)),regionDestination(nodes.get(b)))};
  });
}

export function landSupply(regions,links,origin,target,allowed){
  const remaining=new Map(regions.filter(allowed).map(r=>[r[0],r]));
  if(!remaining.has(origin)||!remaining.has(target))return null;
  const cost=new Map([[origin,0]]),parent=new Map();
  const neighbors=new Map();
  for(const {a,b,km} of links){
    if(!neighbors.has(a))neighbors.set(a,[]);
    if(!neighbors.has(b))neighbors.set(b,[]);
    neighbors.get(a).push([b,km]);neighbors.get(b).push([a,km]);
  }
  while(remaining.size){
    let next,best=Infinity;
    for(const id of remaining.keys())if((cost.get(id)??Infinity)<best){next=id;best=cost.get(id)}
    if(next===undefined)return null;
    if(next===target){
      const byId=new Map(regions.map(r=>[r[0],r]));
      const path=[];
      for(let id=next;id;id=parent.get(id))path.unshift(regionDestination(byId.get(id)));
      return path;
    }
    remaining.delete(next);
    for(const [id,km] of neighbors.get(next)??[])if(remaining.has(id)&&best+km<(cost.get(id)??Infinity)){
      cost.set(id,best+km);parent.set(id,next);
    }
  }
  return null;
}

export function seaSupply(from,to){
  const edge=portLinks.find(([a,b])=>a===from&&b===to||b===from&&a===to);
  if(!edge)return null;
  const stops=shippingWaypoints[edge.join('/')]??[];
  return [harbors[from],...(edge[0]===from?stops:[...stops].reverse()),harbors[to]];
}

export function garrison(state,country,region){return state.garrisons?.[country]?.[region]??{}}
export function changeGarrison(state,country,region,unit,delta){
  const national=((state.garrisons??={})[country]??={});
  const stack=(national[region]??={});
  stack[unit]=(stack[unit]??0)+delta;
}
const naval=(code,scale)=>({
  corvette:code==='BRA'?2:Math.max(1,Math.floor(scale/28)),
  submarine:code==='BRA'?4:['USA','CHN','RUS','GBR','JPN','IND','FRA','AUS','CAN'].includes(code)?Math.max(1,Math.floor(scale/32)):0,
  cruiser:['USA','RUS'].includes(code)?Math.max(1,Math.floor(scale/90)):0,
  carrier:['USA','CHN','GBR'].includes(code)?Math.max(1,Math.floor(scale/85)):0
});
export function seedForces(state,code,regions,scale){
  if(state.garrisons?.[code]||!regions.length)return;
  const hubs=[...regions].sort((a,b)=>(b[2]?.[4]??0)-(a[2]?.[4]??0));
  const total=Math.max(regions.length,Math.round(scale*1.7));
  const military={infantry:total,tank:Math.floor(scale*.28),armor:Math.floor(scale*.46),fighter:Math.floor(scale*.29),transport:Math.floor(scale*.12)};
  for(const [unit,count] of Object.entries(military)){
    const bases=unit==='infantry'?hubs:hubs.slice(0,Math.max(1,Math.ceil(hubs.length/3)));
    for(let i=0;i<count;i++)changeGarrison(state,code,bases[i%bases.length][0],unit,1);
  }
  const ports=hubs.filter(r=>portFor(r[0]));
  if(!ports.length)return;
  for(const [unit,count] of Object.entries(naval(code,scale)))for(let i=0;i<count;i++)changeGarrison(state,code,ports[i%ports.length][0],unit,1);
}

export const stock=(state,id)=>state.stock?.[id]??20;
export function addStock(state,id,delta){(state.stock??={})[id]=stock(state,id)+delta}
