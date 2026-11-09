const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {out}=require('./codir.test.cjs');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{url:'https://example.com/deos-test-v527b/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.fetch=async()=>({ok:true,json:async()=>[]});w.alert=()=>{};w.confirm=()=>true;w.console={...console,log:()=>{},info:()=>{},warn:()=>{}};
w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};
const values={};for(const [name,data] of Object.entries(out.data))values['deos_'+name]=JSON.stringify(data);
values.deos_settings=JSON.stringify({remoteSync:{enabled:false}});
w.localStorage.setItem('deos_codir_test_v1',JSON.stringify({ready:true,values}));
for(const file of ['tools/codir-test-runtime.js','tools/codir-project-assignments.js','tools/codir-transform.js','supabase-client.js','remote-adapter.js','app.js'])w.eval(fs.readFileSync(file,'utf8'));
setTimeout(()=>{
try{
 w.setView('folders');const names=Object.keys(w.DeosCodir.targets);for(const name of names)assert(w.document.querySelector('#app').textContent.includes(name),name);
 assert(w.document.title.includes('D26'));
 w.setView('projects');assert(w.document.querySelector('#app').textContent.includes('Projet 1'));
 w.setView('folders');w.openFolder('f2');assert(w.document.querySelector('#app').textContent.includes("Adaptation des effectifs"));
 w.setView('settings');assert(w.document.querySelector('#app').textContent.includes('copie TEST ne se synchronise pas'));
 console.log('PASS: application complète démarrée, six dossiers rendus, navigation Projets, contenu RH et statut TEST vérifiés.');
}catch(e){console.error(e);process.exitCode=1}finally{w.close();}
},1000);
