/* Resumable, optimistic cloud migration. Archived source folders remain recoverable. */
(function(g){
'use strict';
const MARKER='deos-release-direction-d27-v1',ENTITIES=['folders','projects','actions','managers','decisions','documents','links'];
const same=(a,b)=>g.DeosDirectionPlan.canonical(a)===g.DeosDirectionPlan.canonical(b);
const clone=x=>JSON.parse(JSON.stringify(x));
function readMarker(row){if(!row)return null;try{return JSON.parse(row.item.content)}catch{throw Error('Sauvegarde de migration illisible.');}}
function markerItem(content){return {id:MARKER,title:'Sauvegarde automatique avant organisation CODIR et engagements Direction',type:'Sauvegarde DEOS',archived:true,releaseBackup:true,content:JSON.stringify(content),linkedFolders:[],linkedProjects:[],linkedManagers:[],tags:['Sauvegarde','D27']};}
async function load(api){const entries=await Promise.all(ENTITIES.map(async e=>[e,await api.list(e)]));return Object.fromEntries(entries);}
function snapshot(rows,local){
 const data={...clone(local),...Object.fromEntries(ENTITIES.map(e=>[e,rows[e].filter(r=>r.item.id!==MARKER).map(r=>r.item)]))};
  // Rewrite local-only references after the cloud has been verified.
  const replacements=Object.fromEntries(data.projects.filter(p=>p.migrationSourceFolderId).map(p=>[p.migrationSourceFolderId,p.linkedFolders[0]]));
  function rewrite(node){if(Array.isArray(node)){node.forEach(rewrite);return;}if(!node||typeof node!=='object')return;for(const [k,v] of Object.entries(node)){if(k==='migrationSourceFolderSnapshot')continue;if(['linkedFolders','linkedFolderIds'].includes(k)&&Array.isArray(v))node[k]=[...new Set(v.map(id=>replacements[id]||id))];else if(['folderId','linkedFolderId'].includes(k)&&typeof v==='string')node[k]=replacements[v]||v;else rewrite(v);}}
  for(const [entity,value] of Object.entries(data))if(!ENTITIES.includes(entity))rewrite(value);
 return data;
}
async function run(api,local,legacy=[],owner='browser',status=()=>{}){
 status('Lecture des données synchronisées…');let rows=await load(api),marker=rows.documents.find(r=>r.item.id===MARKER),meta=readMarker(marker);
 if(meta?.status==='completed')return {data:snapshot(rows,local),report:meta.report};
 if(meta?.status==='running'&&meta.owner!==owner&&meta.leaseUntil>Date.now())throw Error('La mise à jour est déjà en cours sur un autre appareil.');
 let prepared;
 if(!meta){
  const source={...local,...Object.fromEntries(ENTITIES.map(e=>[e,rows[e].map(r=>r.item)]))};
  prepared=g.DeosDirectionPlan.prepare(source,g.DeosCodirAssignments,legacy);
  meta={schema:1,status:'running',owner,leaseUntil:Date.now()+10*60*1000,startedAt:new Date().toISOString(),report:prepared.report,operations:prepared.operations};
  await api.backup({source,plan:meta});
  try{marker=await api.create('documents',markerItem(meta));}
  catch(error){if(error.code==='CONFLICT')throw Error('Une autre session a démarré la mise à jour. Rechargez DEOS.');throw error;}
 }else{
  await api.backup({plan:meta});meta={...meta,status:'running',owner,leaseUntil:Date.now()+10*60*1000};marker=await api.update('documents',MARKER,markerItem(meta),marker.version);
 }
 try{
  for(let i=0;i<meta.operations.length;i++){
   const op=meta.operations[i];status('Mise à jour des données : '+(i+1)+' / '+meta.operations.length+'…');
   const row=rows[op.entity].find(r=>r.item.id===op.id);
   if(row&&same(row.item,op.after))continue;
   if(op.before&&(!row||!same(row.item,op.before)))throw Error('Modification concurrente détectée : '+op.entity+' / '+(op.after.name||op.after.title||op.id)+'. Aucune donnée concurrente écrasée.');
   if(!op.before&&row)throw Error('Identifiant déjà utilisé : '+op.id);
   let result;
   if(row)result=await api.update(op.entity,op.id,op.after,row.version);else result=await api.create(op.entity,op.after);
   if(!same(result.item,op.after))throw Error('Écriture non confirmée : '+op.id);
   rows[op.entity]=rows[op.entity].filter(r=>r.item.id!==op.id).concat([result]);
  }
  status('Vérification des actions, projets et dossiers…');rows=await load(api);
  for(const op of meta.operations){const row=rows[op.entity].find(r=>r.item.id===op.id);if(!row||!same(row.item,op.after))throw Error('Contrôle final non confirmé : '+op.id);}
  if(rows.folders.filter(r=>!r.item.archived).length!==6)throw Error('Le contrôle des six dossiers actifs a échoué.');
  meta={...meta,status:'completed',completedAt:new Date().toISOString(),leaseUntil:0};
  await api.update('documents',MARKER,markerItem(meta),marker.version);
  const data=snapshot(rows,local);

  return {data,report:meta.report};
 }catch(error){
  try{meta={...meta,status:'paused',leaseUntil:0,lastError:error.message};await api.update('documents',MARKER,markerItem(meta),marker.version);}catch(_){/* Keep the durable source and optimistic plan for recovery. */}
  throw error;
 }
}
g.DeosDirectionRelease=Object.freeze({run,MARKER,ENTITIES});
})(typeof window!=='undefined'?window:globalThis);
