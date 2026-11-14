const continents={Americas:'americas',Europe:'europe',Africa:'africa',Asia:'asia',Oceania:'oceania'};
const cache=new Map();

export function regionsFor(code,countries){
  const group=continents[countries[code][2]]??'other';
  if(!cache.has(group)){
    const request=fetch('./regions/'+group+'.json').then(response=>{
      if(!response.ok)throw Error('Atlas regional indisponível.');
      return response.json();
    }).catch(error=>{cache.delete(group);throw error});
    cache.set(group,request);
  }
  return cache.get(group).then(data=>data[code]??[]);
}

export function regionDestination(region){
  return region[2]??[region[1],region[5],region[6],false,0];
}

export function mineralRevenue(state){
  return Object.values(state.regions??{}).reduce((sum,region)=>sum+region.resources.reduce((total,site)=>total+site[4],0),0);
}
