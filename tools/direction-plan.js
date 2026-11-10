/* Pure release plan. No credentials, writes or private snapshots in this module. */
(function(g){
'use strict';
const SOURCE='Entretien Soumia — 4 novembre 2026';
const objectives=[
{n:1,title:'Finaliser le benchmark avec Cholet',domain:'Contrôle de gestion',detail:'Consolider le document initié par Nicolas : coûts fixes, nettoyage, maintenance, chariots, frais généraux et conclusions du benchmark.',contacts:'Nicolas',project:'Benchmark avec Cholet',match:/benchmark|bench.*cholet/i},
{n:2,title:"Comparer les heures indirectes et l’organigramme avec Cholet",domain:'Contrôle de gestion',detail:'Établir le comparatif détaillé des heures indirectes et des organigrammes, à tous les niveaux.',contacts:'Cholet',project:'Benchmark avec Cholet',match:/benchmark|bench.*cholet/i,also:'proj-mv7qdy8e-yqw95'},
{n:3,title:'Valider le recrutement et la titularisation de 10 caristes',domain:'RH',detail:'Vérifier le budget, le processus et la trajectoire de recrutement et de titularisation des 10 caristes.',contacts:'Céline / Hadrien',project:'Titularisation de caristes suivie d’embauches',preferred:'proj-mvgndtau-l76qz',match:/titularisation.*caristes/i},
{n:4,title:'Analyser la productivité des intérimaires avec Ilyes',domain:'Exploitation',detail:'Échanger avec Ilyes sur le processus SGLA, analyser la productivité des intérimaires et définir les modalités de duplication à Saint-Gilles.',contacts:'Ilyes',project:'Retour de la productivité Préparation',preferred:'proj-mv7oxgbd-kpmbe',match:/retour.*productivit.*pr[eé]paration/i},
{n:5,title:'Mettre en place les points individuels et les REX',domain:'Direction',detail:'Obtenir auprès de Falilou les budgets d’heures, puis organiser les points individuels et les REX.',contacts:'Falilou',project:'Pilotage managérial et points individuels',match:/pilotage manag[eé]rial|points individuels/i},
{n:6,title:'Préparer le point sur les salariés indirects proches de la retraite',domain:'RH',detail:'Partager avec RH la situation des salariés concernés et les besoins d’anticipation et de transmission.',contacts:'RH',project:'Anticipation des départs en retraite et transmission',match:/d[eé]parts.*retraite|anticipation.*retraite/i},
{n:7,title:'Relancer la digitalisation du poste de garde et l’accueil réception',domain:'RAMSES / Moyens généraux',detail:'Caler avec Béatrice un rendez-vous dans l’agenda de Soumia sur le poste de garde et l’accueil réception.',contacts:'Béatrice',project:'organisation du pupitre au poste de Garde',preferred:'proj-ms8pzycw-rlez3',match:/pupitre.*garde|digitalisation.*garde/i},
{n:8,title:'Faire le point sur la commission de suivi et d’écoute post-grève',domain:'RH',detail:'Faire avec RH le point sur le dispositif post-grève et la commission de suivi et d’écoute du personnel.',contacts:'RH',project:'Stratégie sociale',preferred:'proj-msd7ku47-49dx6',match:/strat[eéè]gie sociale/i},
{n:9,title:'Transmettre au DNAM l’état des dysfonctionnements du nettoyage',domain:'RAMSES / Moyens généraux',detail:'Établir l’état complet des dysfonctionnements de la société de nettoyage et le transmettre au DNAM.',contacts:'Moyens généraux',project:'Nettoyage Nicollin',preferred:'proj-mvi6aivh-apvgx',match:/nettoyage.*nicollin/i},
{n:10,title:'Faire le point sur le réseau Wi-Fi après les travaux',domain:'RAMSES / Moyens généraux',detail:'Vérifier l’état du réseau après les derniers travaux et remonter les éventuels dysfonctionnements.',contacts:'Moyens généraux',project:'Fiabilisation du réseau Wi-Fi',match:/r[eé]seau wi.?fi|fiabilisation.*wi.?fi/i},
{n:11,title:'Informer la filière qualité du test de brief minute PECAZ',domain:'RMPQ',detail:'Présenter à la filière qualité le test de brief minute PECAZ et recueillir ses retours.',contacts:'Qualité',project:"Amélioration du brief 3'",preferred:'proj-msddfc6d-jm1u7',match:/am[eé]lioration.*brief.*3/i}
];
const clone=x=>JSON.parse(JSON.stringify(x));
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>!['id','clientId'].includes(k)&&!k.startsWith('__')&&!k.startsWith('_sync')).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function prepare(input,assignments,legacy=[]){
 const source=clone(input);let data=clone(source);
 const historical=source.folders.filter(f=>f.codirConvertedTo);
 const activeSource=clone({...source,folders:source.folders.filter(f=>!f.codirConvertedTo)});
 // Transport documents may contain JSON strings. Rewrite their links along with other objects.
 const stringDocs=[];
 for(const d of activeSource.documents||[]){if(typeof d.content==='string'&&/PRIORITY_SYNC|JOURNAL_SYNC/.test(d.sourceType||'')){try{d.content=JSON.parse(d.content);stringDocs.push(d.id);}catch{throw Error('Document système illisible : '+d.id);}}}
 const conversion=g.DeosCodir.transform(activeSource,assignments);data=conversion.data;
 for(const d of data.documents||[])if(stringDocs.includes(d.id))d.content=JSON.stringify(d.content);
 if(!conversion.report.alreadyApplied){
  for(const f of source.folders){const p=data.projects.find(p=>p.migrationSourceFolderId===f.id);if(p)historical.push({...f,archived:true,archivedAt:'2026-11-10',codirConvertedTo:p.id});}
 }
 data.folders.push(...historical);
 const addedProjects=[],addedActions=[],reusedActions=[];
 for(const o of objectives){
  const folder=data.folders.find(f=>!f.archived&&f.name===o.domain);if(!folder)throw Error('Dossier CODIR absent : '+o.domain);
  let project=data.projects.find(p=>!p.archived&&(p.id===o.preferred||norm(p.name)===norm(o.project)));
  if(!project){const candidates=data.projects.filter(p=>!p.archived&&o.match.test(p.name||''));if(candidates.length===1)project=candidates[0];else if(candidates.length>1)throw Error('Plusieurs projets possibles : '+o.project);}
  if(!project){const id='proj-direction-20261104-'+({1:'benchmark-cholet',2:'benchmark-cholet',5:'pilotage-managers',6:'retraites',10:'wifi'}[o.n]||o.n);project={id,name:o.project,owner:'Ludovic',objective:o.detail,linkedFolders:[folder.id],linkedManagers:[],linkedActions:[],linkedDecisions:[],linkedDocuments:[],status:'orange',priorityLevel:'orange',progress:0,launchDate:'',deadline:'',archived:false};data.projects.push(project);addedProjects.push(id);}
  const commitmentId='soumia-20261104-'+String(o.n).padStart(2,'0');
  let matches=data.actions.filter(a=>(a.directionCommitments||[]).some(c=>c.id===commitmentId));
  if(!matches.length)matches=data.actions.filter(a=>norm(a.title)===norm(o.title));
  if(matches.length>1)throw Error('Plusieurs actions pour le même engagement : '+o.n);
  let a=matches[0],old=legacy.find(x=>String(x.number)===String(o.n));
  if(!a){a={id:'act-direction-20261104-'+String(o.n).padStart(2,'0'),title:o.title,description:o.detail,objective:o.detail,link:SOURCE+' — '+o.detail,owner:'Ludovic',due:old?.deadline||'',done:old?.status==='Terminé',status:old?.status==='Bloqué'?'blocked':old?.status==='En cours'?'in_progress':'todo',notes:old?.note||'',level:'orange',archived:false,linkedProjects:[],linkedFolders:[],linkedManagers:[]};data.actions.push(a);addedActions.push(a.id);}else reusedActions.push(a.id);
  a.directionCommitments=[...(a.directionCommitments||[]).filter(c=>c.id!==commitmentId),{id:commitmentId,number:o.n,title:o.title,source:SOURCE,sourceDate:'2026-11-04',suggestedContacts:o.contacts}];
  const projectIds=[project.id,...(o.also&&data.projects.some(p=>p.id===o.also)?[o.also]:[])];
  a.linkedProjects=[...new Set([...(a.linkedProjects||[]),...projectIds])];a.linkedFolders=[...new Set([...(a.linkedFolders||[]),folder.id])];
  for(const id of projectIds){const p=data.projects.find(p=>p.id===id);p.linkedActions=[...new Set([...(p.linkedActions||[]),a.id])];}
 }
 // Versions are supplied by the transport, not embedded in domain objects.
 const order=['projects','folders','actions','managers','decisions','documents','links'];const operations=[];
 for(const entity of order){const before=new Map((source[entity]||[]).map(x=>[x.id,x]));for(const item of data[entity]||[]){const prior=before.get(item.id);if(!prior||canonical(prior)!==canonical(item))operations.push({entity,id:item.id,before:prior||null,after:item});}}
 operations.sort((a,b)=>{const rank=o=>!o.before&&o.entity==='projects'?0:o.entity==='folders'&&o.after.codirConvertedTo?3:!o.before?1:2;return rank(a)-rank(b);});
 return {data,operations,report:{...conversion.report,activeFolders:data.folders.filter(f=>!f.archived).length,addedProjects,addedActions,reusedActions,commitments:11}};
}
g.DeosDirectionPlan=Object.freeze({prepare,objectives,canonical,SOURCE});
})(typeof window!=='undefined'?window:globalThis);
