// Diagnostic CODIR intégré à la rubrique Dossiers de DEOS TEST.
// Lecture seule : aucune mutation de state, localStorage ou Supabase.
(function(){
"use strict";
const names=["Direction","Exploitation","RH","RMPQ","RAMSES / Moyens généraux","Contrôle de gestion"];
function render(){
  const app=document.getElementById("app");
  if(!app || typeof currentView==="undefined" || currentView!=="folders" || typeof state==="undefined")return;
  if(app.querySelector("#deos-codir-status"))return;
  const folders=(state.folders||[]).filter(x=>!x.archived),projects=(state.projects||[]).filter(x=>!x.archived);
  const existing=folders.map(x=>String(x.name||""));
  const ready=folders.length===6 && names.every(n=>existing.includes(n));
  const el=document.createElement("div");el.id="deos-codir-status";el.className="card";el.style.cssText="padding:14px;margin-bottom:16px;border-left:4px solid #dba44a";
  const h=document.createElement("strong");h.textContent="Organisation CODIR — contrôle TEST en lecture seule";el.appendChild(h);
  const p=document.createElement("p");p.style.margin="8px 0";p.textContent=ready
    ?"Les six dossiers CODIR sont présents. "+projects.length+" projets actifs."
    :"Réorganisation non appliquée : "+folders.length+" dossiers et "+projects.length+" projets actifs actuellement. Cible : 6 dossiers CODIR et 54 projets.";
  el.appendChild(p);
  const detail=document.createElement("small");detail.textContent="Aucune modification des données : Supabase TEST et PROD partagent la même base.";el.appendChild(detail);

  const projectTargets={"proj-mv7qdy8e-yqw95":"Contrôle de gestion","proj-msn2ttcd-8ued3":"Exploitation","proj-ms756r6z-zi9w3":"Exploitation","proj-ms8pzycw-rlez3":"RAMSES / Moyens généraux","proj-mv7q7zle-ju4ia":"Contrôle de gestion","proj-mscxrifs-f5z6a":"RMPQ","proj-mrlo0s8f-sh1wn":"Direction","proj-mthm1ayi-ke8wp":"Exploitation","proj-mrlo7bys-oiv0f":"Exploitation","proj-ms8lsovg-9hbvi":"Exploitation","proj-msndoc8f-2jnx0":"Direction","proj-mrhef6i8-ya3go":"Exploitation","proj-mrhef6i8-8k76s":"Exploitation","proj-mthm1ayi-68lvy":"RMPQ","proj-mthm1ayi-w3g8x":"RH","proj-mrhef6i8-ouslr":"RH","proj-muf6fw08-8ft7p":"Exploitation","proj-mrlodrc0-koop6":"RMPQ","proj-msnfaytj-ctey2":"Direction","proj-msddfc6d-jm1u7":"Exploitation","proj-ms5x59zz-6ce21":"RH","proj-mv885fsy-h5tz7":"Exploitation","proj-msn2yut6-8k23q":"Direction","proj-ms7crv1g-lbhgs":"Direction","proj-mvi6aivh-apvgx":"RAMSES / Moyens généraux","proj-mrlo1ko9-hi016":"RH","proj-mvi68o21-sg35w":"RAMSES / Moyens généraux","proj-mv88719h-pvces":"Exploitation","proj-mv87w0ny-c4vi1":"Exploitation","proj-muf6kcur-wzvh4":"Exploitation","proj-msmuknep-sesby":"Direction","proj-msn1ctft-owg5e":"RH","proj-ms8ngh4w-j5vhh":"RH","prj-v5-003":"RH","proj-msd7ku47-49dx6":"RH","proj-mv7oxgbd-kpmbe":"Exploitation","prj-v5-001":"Exploitation","prj-v5-002":"Exploitation","proj-mthm1ayi-q0bbi":"Exploitation","prj-v5-004":"Exploitation","proj-mvgndtau-l76qz":"RH","proj-muv0i58l-4geey":"RH","proj-mscxqv34-7gk08":"RMPQ","proj-mscy39eq-8qlf5":"RAMSES / Moyens généraux","proj-mrlo2rs6-xjsfx":"RMPQ","proj-mthm1ayi-xnkzp":"Contrôle de gestion","prj-v5-005":"RMPQ"};
  const countsByFolder=Object.fromEntries(names.map(n=>[n,0]));
  let matched=0;
  for(const project of projects){const target=projectTargets[String(project.clientId||project.id||"")];if(target){countsByFolder[target]++;matched++;}}
  if(matched===47){
    const summary=document.createElement("div");summary.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px";
    for(const name of names){const chip=document.createElement("span");chip.style.cssText="padding:5px 9px;border:1px solid #bbb;border-radius:8px";chip.textContent=name+" : "+countsByFolder[name]+" projets existants";summary.appendChild(chip);}
    el.appendChild(summary);
    const note=document.createElement("small");note.style.display="block";note.style.marginTop="8px";note.textContent="Rattachements calculés depuis le tableau validé du 06/11 ; 7 dossiers thématiques à convertir en projets (total cible : 54). Affichage indicatif, sans modification des données.";el.appendChild(note);
  }
  app.prepend(el);
}
let scheduled=false;
const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;render()},120)});
function boot(){const app=document.getElementById("app");if(app){observer.observe(app,{childList:true});render();}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();