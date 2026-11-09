const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {out,source}=require('./codir.test.cjs');
const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{url:'https://example.com/deos-test-v527b/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;w.indexedDB=new IDBFactory();w.fetch=async()=>({ok:true,json:async()=>[]});w.alert=()=>{};w.confirm=()=>true;w.console={...console,log:()=>{},info:()=>{},warn:()=>{}};
w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};
let raw=Object.fromEntries(Object.entries(source).map(([name,data])=>['deos_'+name,data]));
if(process.env.DEOS_PRIVATE_FIXTURE)raw=JSON.parse(fs.readFileSync(process.env.DEOS_PRIVATE_FIXTURE,'utf8'));
for(const [key,value] of Object.entries(raw))w.localStorage.setItem(key,JSON.stringify(value));
const values={deos_folders:'[]',deos_projects:'[]'};
values.deos_settings=JSON.stringify({remoteSync:{enabled:false}});
w.localStorage.setItem('deos_codir_test_v1',JSON.stringify({ready:false,values}));
(async()=>{
w.eval(fs.readFileSync('tools/codir-test-runtime.js','utf8'));await w.DeosTest.loaded;
for(const file of ['tools/codir-project-assignments.js','tools/codir-transform.js','supabase-client.js','remote-adapter.js','app.js'])w.eval(fs.readFileSync(file,'utf8'));
setTimeout(async()=>{
try{
 const deadline=Date.now()+15000;while(!w.DeosTest.ready()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
 assert(w.DeosTest.ready(),w.document.getElementById("deosStartupStatus")?.textContent);
 w.setView('folders');const names=Object.keys(w.DeosCodir.targets);for(const name of names)assert(w.document.querySelector('#app').textContent.includes(name),name);
 assert(w.document.getElementById('brandVersion').textContent.includes('D26.2'));
 assert(w.DeosTest.ready());
 assert.equal(JSON.parse(w.localStorage.getItem('deos_codir_test_v1')).ready,false);
 w.setView('projects');assert(w.document.querySelector('#app').textContent.includes(process.env.DEOS_PRIVATE_FIXTURE?'Projets':'Projet 1'));
 w.setView('folders');w.openFolder(process.env.DEOS_PRIVATE_FIXTURE?'fold-ms60ptsk-mskhs':'f2');assert(w.document.querySelector('#app').textContent.includes("Adaptation des effectifs"));
 w.setView('settings');assert(w.document.querySelector('#app').textContent.includes('copie TEST ne se synchronise pas'));
 console.log('PASS: application complète démarrée, six dossiers rendus, navigation Projets, contenu RH et statut TEST vérifiés.');
}catch(e){console.error(e);process.exitCode=1}finally{w.close();}
},1000);
})().catch(e=>{console.error(e);process.exitCode=1;w.close();});
