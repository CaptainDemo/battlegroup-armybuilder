import type { ResourceGrant } from '../contracts/catalog';
import type { ResourceLedgerSnapshot } from '../contracts/evaluation';

export interface ResourcePool {producerId:string;grant:ResourceGrant}
export interface ResourceDemand {consumerId:string;ownerId:string|null;memberPath:readonly string[];resourceKind:string;category?:string|undefined;amount:number}
export interface ResourceAllocation {ledgers:ResourceLedgerSnapshot[];unfunded:ResourceDemand[]}

/** Capacity matching with augmenting paths: overlapping category grants cannot be greedily misallocated. */
export function allocateResources(pools:readonly ResourcePool[],demands:readonly ResourceDemand[]):ResourceAllocation {
  const tokens = demands.flatMap(demand=>Array.from({length:demand.amount},()=>demand));
  const assigned:number[][] = pools.map(()=>[]);
  const eligible = (token:number,pool:number):boolean => {
    const demand=tokens[token]!; const {producerId,grant}=pools[pool]!;
    if(grant.resourceKind!==demand.resourceKind) return false;
    if(grant.eligibleCategories && (!demand.category || !grant.eligibleCategories.includes(demand.category))) return false;
    if(grant.scope==='army') return true;
    if(producerId!==demand.ownerId) return false;
    if(grant.scope==='parent-formation') return demand.memberPath.length===0;
    return JSON.stringify(grant.memberPath)===JSON.stringify(demand.memberPath);
  };
  const place = (token:number,visited:Set<number>):boolean => {
    for(let pool=0;pool<pools.length;pool++) {
      if(visited.has(pool)||!eligible(token,pool)) continue;
      visited.add(pool);
      const bucket=assigned[pool]!;
      if(bucket.length<pools[pool]!.grant.capacity){bucket.push(token);return true;}
      for(let i=0;i<bucket.length;i++) if(place(bucket[i]!,visited)){bucket[i]=token;return true;}
    }
    return false;
  };
  const unfunded:ResourceDemand[]=[];
  tokens.forEach((demand,token)=>{if(!place(token,new Set())) unfunded.push({...demand,amount:1});});
  const ledgers:ResourceLedgerSnapshot[]=pools.map((pool,i)=>({resourceKind:pool.grant.resourceKind,scope:pool.grant.scope,selectionId:pool.producerId,...(pool.grant.memberPath?{nodePath:pool.grant.memberPath}:{}),capacity:{state:'known',value:pool.grant.capacity},consumed:assigned[i]!.length,status:'covered'}));
  return {ledgers,unfunded};
}
