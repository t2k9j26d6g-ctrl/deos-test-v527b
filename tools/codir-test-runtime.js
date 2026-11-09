/* TEST only. Source is read-only; one atomic local record holds the independent copy. */
(function(g){
  "use strict";
  if(!g.location.pathname.includes("/deos-test-v527b/"))return;
  const native=g.localStorage,key="deos_codir_test_v1",backupKey="deos_codir_test_source_v1";
  const original={};
  for(let i=0;i<native.length;i++){const k=native.key(i);if(k&&k.startsWith("deos_")&&!k.startsWith("deos_codir_test_"))original[k]=native.getItem(k);}
  const read=()=>JSON.parse(native.getItem(key)||'{"values":{},"ready":false}');
  const write=record=>native.setItem(key,JSON.stringify(record));
  const storage=new Proxy({
    getItem(k){return read().values[k]??null;},
    setItem(k,v){const r=read();r.values[k]=String(v);write(r);},
    removeItem(k){const r=read();delete r.values[k];write(r);},
    key(i){return Object.keys(read().values)[i]??null;},
    get length(){return Object.keys(read().values).length;}
  },{
    ownKeys(){return Object.keys(read().values);},
    getOwnPropertyDescriptor(_t,k){if(k in read().values)return {enumerable:true,configurable:true};}
  });
  const originalJson=(k,fallback)=>{try{return JSON.parse(original[k]??"null")??fallback;}catch(_){throw Error("Copie source locale illisible : "+k);}};
  // Block all shared-database writes, including legacy direct REST paths.
  const fetchOriginal=g.fetch.bind(g);
  const readRpcs=new Set(["deos_current_workspace_id","deos_workspace_role","deos_list_actions","deos_list_projects","deos_list_folders","deos_list_managers","deos_list_decisions","deos_list_documents","deos_list_links"]);
  function requestAllowed(input,options={}){
    const url=new URL(typeof input==="string"?input:input.url,g.location.href);
    if(!url.hostname.endsWith(".supabase.co"))return true;
    const method=String(options.method||input?.method||"GET").toUpperCase();
    if(url.pathname.startsWith("/auth/v1/"))return true;
    if(url.pathname.startsWith("/rest/v1/rpc/"))return readRpcs.has(url.pathname.split("/").pop())&&["GET","POST"].includes(method);
    return ["GET","HEAD","OPTIONS"].includes(method);
  }
  g.fetch=function(input,options){
    if(!requestAllowed(input,options))return Promise.reject(Error("TEST isolé : écriture dans la base partagée bloquée."));
    return fetchOriginal(input,options);
  };
  // Keep identity and login configuration, but never reuse pending production sync queues.
  if(!native.getItem(key))write({ready:false,values:Object.fromEntries(["deos_identity","deos_settings"].filter(k=>original[k]!=null).map(k=>[k,original[k]]))});
  g.DeosTest=Object.freeze({
    storage,requestAllowed,originalJson,
    ready:()=>Boolean(read().ready),
    record:read,
    commit(source,migrated,keys){
      // A failed backup or quota write leaves the prior copy and source untouched.
      if(!native.getItem(backupKey))native.setItem(backupKey,JSON.stringify({createdAt:new Date().toISOString(),source}));
      const r=read(),values={...r.values};
      for(const [name,value] of Object.entries(migrated.data)){if(keys[name])values[keys[name]]=JSON.stringify(value);}
      write({ready:true,createdAt:new Date().toISOString(),report:migrated.report,values});
    }
  });
})(window);
