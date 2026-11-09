/* TEST only: independent IndexedDB copy, source keys and shared database stay read-only. */
(function(g){
  'use strict';
  if(!g.location.pathname.includes('/deos-test-v527b/'))return;
  const native=g.localStorage,key='deos_codir_test_v1',backupKey='deos_codir_test_source_v1';
  const original={};
  for(let i=0;i<native.length;i++){const k=native.key(i);if(k&&k.startsWith('deos_')&&!k.startsWith('deos_codir_test_'))original[k]=native.getItem(k);}
  const clone=x=>JSON.parse(JSON.stringify(x));
  let record={ready:false,values:{}},db=null,scheduled=false,persistence=Promise.resolve();
  function storageError(error){
    console.error('[DEOS TEST storage]',error);
    let node=g.document?.getElementById('deosStartupStatus');
    if(!node && g.document?.getElementById('app')){node=g.document.createElement('div');node.id='deosStartupStatus';node.className='card';node.setAttribute('role','alert');g.document.getElementById('app').before(node);}
    if(node)node.textContent='Enregistrement TEST non confirmé : '+(error?.message||'stockage indisponible')+'. Conservez cet onglet ouvert.';
    g.dispatchEvent?.(new g.CustomEvent('deos-test-storage-error',{detail:{message:error?.message||String(error)}}));
  }
  function transaction(entries){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
      for(const [k,v] of entries)store.put(v,k);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Enregistrement TEST impossible.'));tx.onabort=()=>reject(tx.error||Error('Enregistrement TEST interrompu.'));
    });
  }
  function enqueue(entries){const operation=persistence.catch(()=>{}).then(()=>transaction(entries));persistence=operation;return operation;}
  function schedule(){
    if(scheduled)return;scheduled=true;
    Promise.resolve().then(()=>{scheduled=false;enqueue([[key,clone(record)]]).catch(storageError);});
  }
  const storage=new Proxy({
    getItem(k){return record.values[k]??null;},
    setItem(k,v){record.values[k]=String(v);schedule();},
    removeItem(k){delete record.values[k];schedule();},
    key(i){return Object.keys(record.values)[i]??null;},
    get length(){return Object.keys(record.values).length;}
  },{ownKeys(){return Object.keys(record.values);},getOwnPropertyDescriptor(_t,k){if(k in record.values)return {enumerable:true,configurable:true};}});
  const originalJson=(k,fallback)=>{try{return JSON.parse(original[k]??'null')??fallback;}catch(_){throw Error('Copie source locale illisible : '+k);}};
  const loaded=new Promise((resolve,reject)=>{
    if(!g.indexedDB)return reject(Error('Stockage TEST IndexedDB indisponible. Les données originales sont conservées.'));
    const request=g.indexedDB.open('deos-codir-test',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
    request.onerror=()=>reject(request.error||Error('Ouverture du stockage TEST impossible.'));
    request.onblocked=()=>reject(Error('Un autre onglet bloque la mise à jour du stockage TEST.'));
    request.onsuccess=()=>{
      db=request.result;db.onversionchange=()=>db.close();
      const tx=db.transaction('snapshots','readonly'),read=tx.objectStore('snapshots').get(key);
      read.onerror=()=>reject(read.error);
      read.onsuccess=()=>{
        try{
          record=read.result||JSON.parse(native.getItem(key)||'null')||{ready:false,values:{}};
          if(!record.ready){
            // D26 persisted empty arrays in the new namespace. Recover the original cache instead.
            const safe=Object.fromEntries(Object.entries(original).filter(([k])=>!k.startsWith('deos_sync_')));
            record={...record,values:{...record.values,...safe},ready:false};
          }
          resolve();
        }catch(error){reject(error);}
      };
    };
  });
  const fetchOriginal=g.fetch.bind(g);
  const readRpcs=new Set(['deos_current_workspace_id','deos_workspace_role','deos_list_actions','deos_list_projects','deos_list_folders','deos_list_managers','deos_list_decisions','deos_list_documents','deos_list_links']);
  function requestAllowed(input,options={}){
    const url=new URL(typeof input==='string'?input:input.url,g.location.href);
    if(!url.hostname.endsWith('.supabase.co'))return true;
    const method=String(options.method||input?.method||'GET').toUpperCase();
    if(url.pathname.startsWith('/auth/v1/'))return true;
    if(url.pathname.startsWith('/rest/v1/rpc/'))return readRpcs.has(url.pathname.split('/').pop())&&['GET','POST'].includes(method);
    return ['GET','HEAD','OPTIONS'].includes(method);
  }
  g.fetch=function(input,options){if(!requestAllowed(input,options))return Promise.reject(Error('TEST isolé : écriture dans la base partagée bloquée.'));return fetchOriginal(input,options);};
  g.DeosTest=Object.freeze({
    storage,loaded,requestAllowed,originalJson,ready:()=>Boolean(record.ready),record:()=>clone(record),flush:async()=>{await Promise.resolve();await persistence;},
    async commit(source,migrated,keys){
      await loaded;
      const values={...record.values};
      for(const [name,value] of Object.entries(migrated.data))if(keys[name])values[keys[name]]=JSON.stringify(value);
      const next={ready:true,createdAt:new Date().toISOString(),report:migrated.report,values};
      await enqueue([[backupKey,{createdAt:new Date().toISOString(),source:clone(source)}],[key,next]]);
      record=next;
    }
  });
})(window);
