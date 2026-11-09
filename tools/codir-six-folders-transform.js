/* DEOS CODIR: pure, non-mutating transformation. No Supabase requests or storage writes.
   Not loaded by index.html. For controlled migration tooling only. */
(function (global) {
  "use strict";
  const TARGETS = Object.freeze({
    "Direction":"DE",
    "Exploitation":"Exploitation",
    "RH":"RH",
    "RMPQ":"Qualité",
    "RAMSES / Moyens généraux":"Infrastructure",
    "Contrôle de gestion":"Contrôle Gestion"
  });
  const THEMES = Object.freeze({
    "Adaptation des effectifs et recours à l'intérim":"RH",
    "Gestion des pointage 099 et des temps improductifs":"Contrôle de gestion",
    "IPO":"Contrôle de gestion",
    "Réduction casse / non-livrés / litiges magasins":"RMPQ",
    "Productivité":"Exploitation",
    "Réduction des heures de polyvalence":"Exploitation",
    "Mise en place de tables rondes":"RH"
  });
  function transform(snapshot, projectAssignments) {
    if (!snapshot || !Array.isArray(snapshot.folders) || !Array.isArray(snapshot.projects)) throw Error("Snapshot dossiers/projets requis");
    if (!projectAssignments || typeof projectAssignments !== "object") throw Error("Rattachements des projets requis");
    const data=structuredClone(snapshot);
    const byName=new Map(data.folders.map(f=>[f.name,f]));
    if(data.folders.some(f=>!f.id)||data.projects.some(p=>!p.id)) throw Error("Identifiants absents : fournir des objets enrichis avec les ID des lignes Supabase");
    if (data.folders.length!==13 || data.projects.length!==47) throw Error("Inventaire différent du 06/11 : migration arrêtée");
    const targets={};
    for(const [target,oldName] of Object.entries(TARGETS)){
      const folder=byName.get(oldName);
      if(!folder) throw Error("Dossier permanent introuvable : "+oldName);
      folder.name=target;
      folder.category=target;
      targets[target]=folder.id;
    }
    const replacement={};
    const converted=[];
    for(const [oldName,target] of Object.entries(THEMES)){
      const folder=byName.get(oldName);
      if(!folder) throw Error("Dossier thématique introuvable : "+oldName);
      replacement[folder.id]=targets[target];
      const id="proj-from-"+folder.id;
      if(data.projects.some(p=>p.id===id)) throw Error("Projet converti déjà existant : "+id);
      converted.push({id,clientId:id,name:oldName,objective:folder.objectives||"",context:folder.context||folder.description||"",owner:folder.owner||"",linkedFolders:[targets[target]],linkedManagers:folder.linkedManagers||[],linkedActions:[],linkedDecisions:[],linkedDocuments:[],status:folder.status||"orange",priorityLevel:folder.priorityLevel||"orange",progress:0,archived:Boolean(folder.archived),migrationSourceFolderId:folder.id,migrationSourceFolderSnapshot:structuredClone(folder)});
    }
    for(const project of data.projects){
      const target=projectAssignments[project.id];
      if(!targets[target]) throw Error("Affectation manquante/invalide : "+project.id);
      project.linkedFolders=[targets[target]];
      if (Object.prototype.hasOwnProperty.call(project,"linkedFolderIds")) project.linkedFolderIds=[targets[target]];
      if (Object.prototype.hasOwnProperty.call(project,"folderId")) project.folderId=targets[target];
    }
    const rewrite=(node)=>{
      if(Array.isArray(node)){node.forEach(rewrite);return;}
      if(!node||typeof node!=="object")return;
      for(const [key,value] of Object.entries(node)){
        if(key==="migrationSourceFolderSnapshot")continue;
        if(key==="linkedFolders"&&Array.isArray(value))node[key]=[...new Set(value.map(id=>replacement[id]||id))];
        else if(key==="linkedFolderIds"&&Array.isArray(value))node[key]=[...new Set(value.map(id=>replacement[id]||id))];
        else if((key==="folderId"||key==="linkedFolderId")&&typeof value==="string")node[key]=replacement[value]||value;
        else rewrite(value);
      }
    };
    data.projects.push(...converted);
    data.folders=data.folders.filter(f=>!replacement[f.id]);
    rewrite(data);
    if(data.folders.length!==6||data.projects.length!==54)throw Error("Comptages inattendus");
    const ids=new Set(data.folders.map(f=>f.id));
    const errors=[];
    const validate=(node)=>{
      if(Array.isArray(node)){node.forEach(validate);return;}
      if(!node||typeof node!=="object")return;
      for(const [key,value] of Object.entries(node)){
        if(key==="migrationSourceFolderSnapshot")continue;
        if((key==="linkedFolders"||key==="linkedFolderIds")&&Array.isArray(value))value.forEach(id=>{if(typeof id==="string"&&!ids.has(id))errors.push(id)});
        else if((key==="folderId"||key==="linkedFolderId")&&typeof value==="string"&&!ids.has(value))errors.push(value);
        else validate(value);
      }
    };
    validate(data);
    if(errors.length)throw Error("Références dossiers invalides : "+errors.slice(0,10).join(", "));
    return {data,report:{foldersBefore:13,foldersAfter:6,projectsBefore:47,projectsAfter:54,convertedFolders:converted.map(p=>p.name),referencesValid:true,readOnly:true}};
  }
  global.DeosCodirMigration=Object.freeze({transform,TARGETS,THEMES});
})(typeof window!=="undefined"?window:globalThis);
