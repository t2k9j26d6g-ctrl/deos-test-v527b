/* Pure migration: no database access, no storage, source snapshot unchanged. */
(function(g){
  "use strict";
  const targets={"Direction":"DE","Exploitation":"Exploitation","RH":"RH","RMPQ":"Qualité","RAMSES / Moyens généraux":"Infrastructure","Contrôle de gestion":"Contrôle Gestion"};
  const themes={"Adaptation des effectifs et recours à l'intérim":"RH","Gestion des pointage 099 et des temps improductifs":"Exploitation","IPO":"Direction","Réduction casse / non-livrés / litiges magasins":"RMPQ","Productivité":"Exploitation","Réduction des heures de polyvalence":"Exploitation","Mise en place de tables rondes":"Direction"};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/pointages/g,"pointage").trim().toLowerCase();
  function transform(source,assignments={}){
    if(!Array.isArray(source?.folders)||!Array.isArray(source?.projects))throw Error("Dossiers et projets requis.");
    const data=copy(source), folders=data.folders, projects=data.projects;
    const names=Object.keys(targets);
    if(folders.length===6&&names.every(n=>folders.some(f=>f.name===n)))return {data,report:{alreadyApplied:true,converted:0}};
    if(folders.length!==13)throw Error("Inventaire des dossiers modifié : reclassement automatique suspendu.");
    const byName=new Map(folders.map(f=>[norm(f.name),f]));
    if(byName.size!==13||folders.some(f=>!f.id)||new Set(folders.map(f=>f.id)).size!==13)throw Error("Dossiers sans identifiant ou dupliqués.");
    if(projects.some(p=>!p.id)||new Set(projects.map(p=>p.id)).size!==projects.length)throw Error("Identifiants projets absents ou dupliqués.");
    const ids={}, replacement={}, convertedIds={};
    for(const [name,old] of Object.entries(targets)){
      const f=byName.get(norm(old));if(!f)throw Error("Dossier introuvable : "+old);
      ids[name]=f.id; f.name=name;f.category=name;
    }
    const converted=[];
    for(const [old,name] of Object.entries(themes)){
      const f=byName.get(norm(old));if(!f)throw Error("Dossier thématique introuvable : "+old);
      const id="proj-from-"+f.id;
      if(projects.some(p=>p.id===id))throw Error("Conversion partielle détectée : "+id);
      replacement[f.id]=ids[name];convertedIds[f.id]=id;
      converted.push({...copy(f),id,clientId:id,name:f.name,objective:f.objectives||f.objective||"",context:[f.description,f.context].filter(Boolean).join("\n\n"),linkedFolders:[ids[name]],launchDate:f.launchDate||f.createdAt||"",progress:Number(f.progress||0),directorNotes:Array.isArray(f.directorNotes)?f.directorNotes:[],migrationSourceFolderId:f.id,migrationSourceFolderSnapshot:copy(f)});
    }
    const originalIds=new Set(folders.map(f=>f.id));
    const mapped=id=>replacement[id]||id;
    for(const p of projects){
      const known=assignments[p.clientId||p.id]||assignments[p.id];
      const prior=p.linkedFolders||p.linkedFolderIds||(p.folderId?[p.folderId]:[]);
      const inferred=[...new Set(prior.map(mapped))];
      const target=known?ids[known]:(inferred.length===1?inferred[0]:null);
      if(!target||!Object.values(ids).includes(target))throw Error("Affectation projet à vérifier : "+p.name+" ("+p.id+")");
      p.linkedFolders=[target];
      if("linkedFolderIds" in p)p.linkedFolderIds=[target];
      if("folderId" in p)p.folderId=target;
    }
    // Preserve thematic membership in both directions, as well as its new CODIR folder.
    for(const [entity,items] of Object.entries(data)){
      if(entity==="folders"||!Array.isArray(items))continue;
      for(let i=0;i<items.length;i++){
        const original=source[entity]?.[i], item=items[i];if(!original||!item||typeof item!=="object")continue;
        const refs=original.linkedFolders||original.linkedFolderIds||(original.folderId?[original.folderId]:[]);
        for(const oldId of refs){
          const projectId=convertedIds[oldId];if(!projectId||entity==="projects")continue;
          item.linkedProjects=[...new Set([...(item.linkedProjects||[]),projectId])];
          if("linkedProjectIds" in item)item.linkedProjectIds=[...new Set([...(item.linkedProjectIds||[]),projectId])];
          const project=converted.find(p=>p.id===projectId),key={actions:"linkedActions",decisions:"linkedDecisions",documents:"linkedDocuments",managers:"linkedManagers"}[entity];
          if(key)project[key]=[...new Set([...(project[key]||[]),item.id])];
        }
      }
    }
    function rewrite(node){
      if(Array.isArray(node)){node.forEach(rewrite);return;}
      if(!node||typeof node!=="object")return;
      for(const [key,val] of Object.entries(node)){
        if(key==="migrationSourceFolderSnapshot")continue;
        if(["linkedFolders","linkedFolderIds"].includes(key)&&Array.isArray(val))node[key]=[...new Set(val.map(mapped))];
        else if(["folderId","linkedFolderId"].includes(key)&&typeof val==="string")node[key]=mapped(val);
        else rewrite(val);
      }
      if(["folder","folders","Dossier"].includes(node.sourceType)&&convertedIds[node.sourceId]){node.sourceType=node.sourceType==="folders"?"projects":"project";node.sourceId=convertedIds[node.sourceId];}
      if(["folder","folders"].includes(node.entity)&&convertedIds[node.id]){node.entity=node.entity==="folders"?"projects":"project";node.id=convertedIds[node.id];}
    }
    data.projects.push(...converted);data.folders=folders.filter(f=>!replacement[f.id]);rewrite(data);
    const valid=new Set(data.folders.map(f=>f.id));
    function validate(node){
      if(Array.isArray(node)){node.forEach(validate);return;}
      if(!node||typeof node!=="object")return;
      for(const [key,val] of Object.entries(node)){
        if(key==="migrationSourceFolderSnapshot")continue;
        if(["linkedFolders","linkedFolderIds"].includes(key)&&Array.isArray(val)){if(val.some(id=>!valid.has(id)))throw Error("Référence dossier invalide.");}
        else if(["folderId","linkedFolderId"].includes(key)&&val&&!valid.has(val))throw Error("Référence dossier invalide.");
        else validate(val);
      }
    }
    validate(data);
    return {data,report:{foldersBefore:originalIds.size,foldersAfter:data.folders.length,projectsBefore:source.projects.length,projectsAfter:data.projects.length,converted:converted.length,referencesValid:true}};
  }
  g.DeosCodir=Object.freeze({transform,targets,themes});
})(typeof window!=="undefined"?window:globalThis);
