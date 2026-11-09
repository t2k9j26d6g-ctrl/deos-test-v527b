const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.createContext(ctx);
for(const file of ['tools/codir-transform.js','tools/codir-project-assignments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const {transform,targets,themes}=ctx.DeosCodir;
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
const folders=[...Object.values(targets),...Object.keys(themes)].map((name,i)=>({id:'f'+i,name,createdAt:'2026-01-02',deadline:'2026-12-09',owner:'Manager',description:'Description',context:'Contexte',directorNotes:'Note historique',linkedManagers:['m1'],events:[{date:'2026-01-02',text:'Historique'}]}));
const projects=Object.entries(ctx.DeosCodirAssignments).map(([id],i)=>({id,name:'Projet '+i,linkedFolders:['f6'],archived:i===0,linkedActions:['a1']}));
return {folders,projects,actions:[{id:'a1',linkedFolderIds:['f6'],linkedProjectIds:[projects[0].id],due:'2026-12-09'}],documents:[{id:'d1',folderId:'f7',content:'Preuve'}],decisions:[{id:'de1',linkedFolders:['f8']}],journal:[{id:'j1',linkedFolders:['f9'],notes:'Conserver'}],priorities:[{id:'t1',linkedFolders:['f10']}],managers:[{id:'m1',linkedFolders:['f11']}],activity:[{id:'event1',sourceType:'folders',sourceId:'f6'}]};}
const source=fixture(),before=JSON.stringify(source),out=transform(source,ctx.DeosCodirAssignments);
assert.equal(JSON.stringify(source),before);assert.equal(out.data.folders.length,6);assert.equal(out.data.projects.length,54);
for(const p of source.projects){const q=out.data.projects.find(x=>x.id===p.id);assert(q);assert.equal(q.archived,p.archived);assert.deepEqual(plain(q.linkedActions),p.linkedActions);}
for(const entity of ['actions','decisions','documents','journal','priorities','managers','activity'])assert.equal(out.data[entity].length,source[entity].length);
const rh=out.data.folders.find(f=>f.name==='RH').id;
assert.deepEqual(plain(out.data.actions[0].linkedFolderIds),[rh]);assert(out.data.actions[0].linkedProjects.includes('proj-from-f6'));
assert(out.data.projects.find(p=>p.id==='proj-from-f6').linkedActions.includes('a1'));
assert.equal(out.data.projects.find(p=>p.id==='proj-from-f6').migrationSourceFolderSnapshot.directorNotes,'Note historique');
assert.equal(out.data.projects.find(p=>p.id==='proj-from-f6').directorNotes[0].content,'Note historique');
assert.equal(out.data.projects.find(p=>p.id==='proj-from-f6').deadline,'2026-12-09');
assert.equal(out.data.activity[0].sourceType,'projects');assert.equal(out.data.activity[0].sourceId,'proj-from-f6');
assert.equal(JSON.stringify(transform(out.data,ctx.DeosCodirAssignments).data),JSON.stringify(out.data));
assert.throws(()=>transform({...source,folders:source.folders.slice(1)},ctx.DeosCodirAssignments));
assert.throws(()=>transform({...source,projects:[...source.projects,{id:'unknown',name:'Unknown'}]},ctx.DeosCodirAssignments));
const newer=plain(source);newer.projects.push({id:'new',name:'Nouveau',linkedFolders:['f0']});assert.equal(transform(newer,ctx.DeosCodirAssignments).data.projects.length,55);
// The spelling in the plan and in the real export are both accepted.
const spelling=plain(source);spelling.folders[7].name=spelling.folders[7].name.replace('pointage','pointages');assert.equal(transform(spelling,ctx.DeosCodirAssignments).data.folders.length,6);
function storage(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function runtime(path='/deos-test-v527b/'){
 const localStorage=storage();localStorage.setItem('deos_folders',JSON.stringify(source.folders));
 const window={location:{pathname:path,href:'https://example.com'+path},localStorage,fetch:async()=>({ok:true})};
 vm.runInNewContext(fs.readFileSync('tools/codir-test-runtime.js','utf8'),{window,URL,Set,JSON,Date,Object,Error,Promise});return window;
}
const w=runtime(),original=w.localStorage.getItem('deos_folders'),test=w.DeosTest;
assert(test);assert.equal(test.ready(),false);test.storage.setItem('deos_folders','[]');assert.equal(w.localStorage.getItem('deos_folders'),original);
assert(Object.keys(test.storage).includes('deos_folders'));
const url='https://source.supabase.co/rest/v1/';
assert(test.requestAllowed(url+'deos_projects',{method:'GET'}));assert(!test.requestAllowed(url+'deos_projects',{method:'POST'}));
for(const m of ['POST','PUT','PATCH','DELETE'])assert(!test.requestAllowed(url+'deos_folders',{method:m}));
assert(test.requestAllowed(url+'rpc/deos_list_folders',{method:'POST'}));assert(!test.requestAllowed(url+'rpc/deos_update_folder',{method:'POST'}));assert(!test.requestAllowed(url+'rpc/deos_initialize_workspace',{method:'POST'}));
assert.equal(runtime('/deos-prod/').DeosTest,undefined);
test.commit(source,out,{folders:'deos_folders',projects:'deos_projects'});assert(test.ready());assert.equal(JSON.parse(test.storage.getItem('deos_folders')).length,6);assert.equal(w.localStorage.getItem('deos_folders'),original);
const ready=w.localStorage.getItem('deos_codir_test_v1');w.localStorage.setItem=(k,v)=>{throw Error('QUOTA')};assert.throws(()=>test.commit(source,out,{folders:'deos_folders'}));assert.equal(w.localStorage.getItem('deos_codir_test_v1'),ready);
// Integration: actual production bootstrap function, read-only adapter, one atomic commit.
const app=fs.readFileSync('app.js','utf8');
const bootstrap=app.slice(app.indexOf('let codirTestCopyPromise = null;'),app.indexOf('\nasync function init() {'));
const integration=runtime(),state={};const entities=Object.keys(source);const keys=Object.fromEntries(entities.map(x=>[x,'deos_'+x]));let calls=0;
const adapter={};for(const [e,m,p] of [['folders','listFolders','folder'],['projects','listProjects','project'],['actions','listActions','action'],['managers','listManagers','manager'],['decisions','listDecisions','decision'],['documents','listDocuments','document'],['links','listLinks','link']])adapter[m]=async()=>{calls++;return (source[e]||[]).map(x=>({clientId:x.id,[p]:{...x,id:'server-uuid-must-not-win'}}))};
const c={window:{DeosTest:integration.DeosTest,DeosCodir:ctx.DeosCodir,DeosCodirAssignments:ctx.DeosCodirAssignments},entities,DEOS_STORAGE_KEYS:keys,state,deosRemoteAuthService:{isAuthenticated:()=>true},deosRemoteRuntime:{workspace:{id:'source'}},deosRemoteAdapter:adapter,withRemoteTimeout:p=>p,document:{getElementById:()=>({})},setDeosStartupStatus:()=>{},setView:()=>{},currentView:'folders',normalizeCollection:(_n,x)=>x,isPrioritySyncTransportDocument:()=>false,isJournalSyncTransportDocument:()=>false,console};
vm.createContext(c);vm.runInContext(bootstrap,c);
(async()=>{await vm.runInContext('Promise.all([prepareCodirTestCopy(),prepareCodirTestCopy()])',c);assert.equal(calls,7);assert.equal(state.folders.length,6);assert.equal(state.projects.length,54);assert.equal(state.projects[0].id,source.projects[0].id);state.projects[0].name='Modification TEST';await vm.runInContext('prepareCodirTestCopy()',c);assert.equal(state.projects[0].name,'Modification TEST');assert.equal(calls,7);console.log('PASS: migration 13→6 / 47→54, relations, archives, idempotence, nouveaux projets, isolation, réseau, quota et initialisation concurrente.');})().catch(e=>{console.error(e);process.exitCode=1});
module.exports={source,out};
