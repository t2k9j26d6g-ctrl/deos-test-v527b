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
  app.prepend(el);
}
let scheduled=false;
const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;render()},120)});
function boot(){const app=document.getElementById("app");if(app){observer.observe(app,{childList:true});render();}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();