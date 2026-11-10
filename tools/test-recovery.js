/* Same-origin TEST recovery. Only edits relative to the TEST baseline are imported. */
(function(g){
'use strict';
const CLOUD=['folders','projects','actions','managers','decisions','documents','links'];
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const ignored=new Set(['updatedAt','createdAt','lastSyncedAt','remoteUpdatedAt','remoteVersion','remoteId','clientId','migrationSourceFolderSnapshot']);
function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).filter(k=>!ignored.has(k)&&!k.startsWith('_sync')&&!k.startsWith('__')).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
const eq=(a,b)=>stable(a)===stable(b);
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const systemDoc=d=>/DEOS_(PRIORITY|JOURNAL)_SYNC/.test(d.sourceType||'')||/^deos-system-(priorities|journal)-sync/.test(d.id||'');
function mergeValue(base,test,prod,path,conflicts){
 if(eq(test,base)||eq(test,prod))return clone(prod);
 if(eq(prod,base))return clone(test);
 if(object(test)&&object(prod)&&(base===undefined||object(base))){const out=clone(prod);for(const key of new Set([...Object.keys(base||{}),...Object.keys(test),...Object.keys(prod)])){if(ignored.has(key)||key.startsWith('_sync')||key.startsWith('__'))continue;const next=mergeValue(base?.[key],test[key],prod[key],path+'.'+key,conflicts);if(next===undefined)delete out[key];else out[key]=next;}return out;}
 if(Array.isArray(test)&&Array.isArray(prod)&&(base===undefined||Array.isArray(base))){
  const b=base||[];
  if([...b,...test,...prod].every(v=>v===null||typeof v!=='object')){const removed=b.filter(x=>!test.some(y=>eq(x,y)));return [...prod.filter(x=>!removed.some(y=>eq(x,y))),...test.filter(x=>!b.some(y=>eq(x,y))&&!prod.some(y=>eq(x,y)))].map(clone);}
  if([...b,...test,...prod].every(v=>object(v)&&v.id)){const bm=new Map(b.map(v=>[v.id,v])),tm=new Map(test.map(v=>[v.id,v])),pm=new Map(prod.map(v=>[v.id,v]));const out=[];for(const id of new Set([...pm.keys(),...tm.keys()])){const merged=mergeValue(bm.get(id),tm.get(id),pm.get(id),path+'['+id+']',conflicts);if(merged!==undefined)out.push(merged);}return out;}
 }
 conflicts.push({path,base:clone(base),test:clone(test),prod:clone(prod)});return clone(prod);
}
function merge(base,test,prod){
 const data=clone(prod),conflicts=[],changed=[];
 for(const entity of Object.keys(test)){
  if(!Array.isArray(test[entity])){if(object(test[entity])){data[entity]=mergeValue(base[entity],test[entity],prod[entity],entity,conflicts);if(!eq(data[entity],prod[entity]))changed.push({entity,id:'collection'});}continue;}
  const filter=items=>(items||[]).filter(x=>entity!=='documents'||!systemDoc(x));
  const bm=new Map(filter(base[entity]).map(x=>[x.id,x])),tm=new Map(filter(test[entity]).map(x=>[x.id,x])),pm=new Map((prod[entity]||[]).map(x=>[x.id,x]));
  for(const [id,b] of bm)if(!tm.has(id))conflicts.push({path:entity+'['+id+']',kind:'deleted-in-test',base:clone(b),test:null,prod:clone(pm.get(id))});
  for(const [id,t] of tm){const b=bm.get(id),p=pm.get(id);if(eq(t,b))continue;const value=mergeValue(b,t,p,entity+'['+id+']',conflicts);if(value!==undefined&&!eq(value,p)){pm.set(id,value);changed.push({entity,id});}}
  data[entity]=[...pm.values()];
 }
 return {data,conflicts,changed};
}
async function openStore(){
 return new Promise((resolve,reject)=>{let missing=false;const r=g.indexedDB.open('deos-codir-test');r.onupgradeneeded=()=>{missing=true;r.transaction.abort();};r.onerror=()=>missing?resolve(null):reject(r.error);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('snapshots')){db.close();resolve(null);}else resolve(db);};});
}
const get=(db,key)=>new Promise((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const put=(db,key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
async function read(workspaceId,keys){
 const db=await openStore();if(!db)return null;
 const record=await get(db,'deos_codir_test_v1'),backup=await get(db,'deos_codir_test_source_v1'),checkpoint=await get(db,'deos-test-recovered-'+workspaceId);
 if(!record?.ready){db.close();return null;}
 if(!backup?.source&&!checkpoint?.test){db.close();throw Error('La copie TEST existe mais sa référence de départ est absente. Aucune saisie TEST ne sera écrasée.');}
 const test={};for(const [entity,key] of Object.entries(keys)){if(record.values[key]!==undefined){try{test[entity]=JSON.parse(record.values[key]);}catch{db.close();throw Error('Collection TEST illisible : '+entity);}}}
 const base=clone(checkpoint?.test||g.DeosCodir.transform(backup.source,g.DeosCodirAssignments).data);
 // The old Engagements Direction prototype used its own localStorage key.
 const legacy=JSON.parse(g.localStorage.getItem('deos_test_engagements_direction_v1')||'[]');
 if(!Array.isArray(legacy))throw Error('Le suivi local Engagements Direction est illisible.');
 for(const item of legacy){
  const n=Number(item.number);if(!Number.isInteger(n)||n<1||n>11)continue;
  const id='act-direction-20261104-'+String(n).padStart(2,'0');
  if((test.actions||[]).some(a=>a.id===id))continue;
  const original={id,notes:'',due:'',done:false,status:'todo'};
  if(!(base.actions||[]).some(a=>a.id===id))(base.actions||(base.actions=[])).push(original);
  (test.actions||(test.actions=[])).push({...original,notes:item.note||'',due:item.deadline||'',done:item.status==='Terminé',status:item.status==='Bloqué'?'blocked':item.status==='En cours'?'in_progress':'todo'});
 }
 return {db,base,test,checkpoint};
}
async function run(api,current,keys,normalize=x=>x,status=()=>{}){
 const source=await read(api.workspaceId,keys);if(!source)return null;
 if(source.checkpoint?.recoveredAt){source.db.close();return null;}
 // Recovery is a one-time cutover; later TEST experiments stay isolated.
 try{
  const base=normalize(clone(source.base)),test=normalize(clone(source.test));
  const bytes=new TextEncoder().encode(stable(test));const hash=Array.from(new Uint8Array(await g.crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
  if(source.checkpoint?.hash===hash){source.db.close();return null;}
  status('Récupération des saisies faites dans TEST…');
  let rows=Object.fromEntries(await Promise.all(CLOUD.map(async e=>[e,await api.list(e)])));
  const prod={...clone(current),...Object.fromEntries(CLOUD.map(e=>[e,rows[e].map(r=>r.item)]))};
  let pending=await get(source.db,'deos-test-recovery-pending-'+api.workspaceId);
  if(!pending||pending.hash!==hash){
   const result=merge(base,test,prod);const operations=[];
   for(const {entity,id} of result.changed)if(CLOUD.includes(entity)){const before=rows[entity].find(r=>r.item.id===id);operations.push({entity,id,before:before?.item,after:result.data[entity].find(x=>x.id===id)});}
   operations.sort((a,b)=>{const rank=o=>!o.before&&o.entity==='folders'?0:!o.before&&o.entity==='projects'?1:!o.before?2:3;return rank(a)-rank(b);});
   pending={hash,test,prod,data:result.data,conflicts:result.conflicts,changed:result.changed,operations};
   await put(source.db,'deos-test-recovery-pending-'+api.workspaceId,pending);
   await api.backup(pending,'test-recovery-'+hash.slice(0,16));
  }
  const backupId='deos-test-recovery-backup-'+hash.slice(0,20);
  if(!rows.documents.some(r=>r.item.id===backupId)){
   try{const saved=await api.create('documents',{id:backupId,title:'Sauvegarde avant reprise des saisies TEST',type:'Sauvegarde DEOS',archived:true,testRecoveryBackup:true,content:JSON.stringify({hash,operations:pending.operations}),linkedFolders:[],linkedProjects:[]});rows.documents.push(saved);}catch(e){if(e.code!=='CONFLICT')throw e;}
  }
  for(let i=0;i<pending.operations.length;i++){
   const op=pending.operations[i],row=rows[op.entity].find(r=>r.item.id===op.id);status('Reprise TEST : '+(i+1)+' / '+pending.operations.length+'…');
   if(row&&eq(row.item,op.after))continue;
   if(!eq(row?.item,op.before)){pending.conflicts.push({path:op.entity+'['+op.id+']',kind:'concurrent-update',base:op.before,test:op.after,prod:row?.item});continue;}
   try{const saved=row?await api.update(op.entity,op.id,op.after,row.version):await api.create(op.entity,op.after);if(!eq(saved.item,op.after))throw Error('Reprise TEST non confirmée : '+op.id);rows[op.entity]=rows[op.entity].filter(r=>r.item.id!==op.id).concat([saved]);}
   catch(e){if(e.code!=='CONFLICT'&&!/CONFLICT|concurr|version/i.test(e.message||''))throw e;pending.conflicts.push({path:op.entity+'['+op.id+']',kind:'concurrent-update',test:op.after,prod:row?.item});}
  }
  // Preserve concurrent edits to local-only collections as well.
  const local=merge(pending.prod,pending.data,current);pending.conflicts.push(...local.conflicts);
  if(pending.conflicts.length){
   const reportId='deos-test-recovery-conflicts-'+hash.slice(0,20);
   if(!rows.documents.some(r=>r.item.id===reportId))rows.documents.push(await api.create('documents',{id:reportId,title:'Reprise TEST — éléments à arbitrer',type:'Compte rendu',archived:false,content:'Les versions PROD ont été conservées lorsqu’elles divergeaient des saisies TEST. Les variantes TEST restent disponibles ci-dessous.\n\n'+JSON.stringify(pending.conflicts,null,2),linkedFolders:[],linkedProjects:[]}));
  }
  rows=Object.fromEntries(await Promise.all(CLOUD.map(async e=>[e,await api.list(e)])));
  const data={...local.data,...Object.fromEntries(CLOUD.map(e=>[e,rows[e].map(r=>r.item)]))};
  await put(source.db,'deos-test-recovery-pending-'+api.workspaceId,pending);
  const report={changed:pending.changed.length,conflicts:pending.conflicts.length};
  return {data,report,async checkpoint(){await put(source.db,'deos-test-recovered-'+api.workspaceId,{hash,test:source.test,recoveredAt:new Date().toISOString(),report});source.db.close();},close(){source.db.close();}};
 }catch(error){source.db.close();throw error;}
}
g.DeosTestRecovery=Object.freeze({merge,run,stable,read});
})(typeof window!=='undefined'?window:globalThis);
