const endpoint='https://routing.openstreetmap.de/routed-car/route/v1/driving/';
const cache=new Map();
let lastRequest=0;
let queue=Promise.resolve();

export function verifyRoad(points){
  const coordinates=points.map(p=>p.slice(1,3).map(n=>n.toFixed(5)).join(',')).join(';');
  if(cache.has(coordinates))return cache.get(coordinates);
  const job=queue.then(async()=>{
    const delay=1100-(Date.now()-lastRequest);
    if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
    lastRequest=Date.now();
    const response=await fetch(endpoint+coordinates+'?steps=true&overview=simplified&geometries=geojson',{
      signal:AbortSignal.timeout(15000)
    });
    if(!response.ok)throw Error('Serviço rodoviário indisponível. Tente novamente.');
    const data=await response.json(), route=data.routes?.[0];
    if(!route?.geometry?.coordinates?.length||!route.distance||
        data.waypoints?.some(p=>p.distance>12000)||
        route.legs?.some(leg=>leg.steps.some(step=>step.mode!=='driving'))){
      throw Error('Sem ligação contínua por estrada. Tente transporte marítimo ou aéreo.');
    }
    return {
      km:route.distance/1000,
      hours:route.duration/3600,
      points:[points[0],...route.geometry.coordinates.map(([x,y])=>['',x,y]),points.at(-1)]
    };
  });
  queue=job.catch(()=>{});
  cache.set(coordinates,job);
  job.catch(()=>cache.delete(coordinates));
  return job;
}
