/* Wait for durable TEST storage before the existing application reads synchronous repositories. */
(async function(){
  try {
    if(window.DeosTest)await window.DeosTest.loaded;
    const safety=document.createElement('script');safety.src='tools/safeguard.js?v=27.3';
    await new Promise((resolve,reject)=>{safety.onload=resolve;safety.onerror=reject;document.body.appendChild(safety);});
    const script=document.createElement('script');script.src='app.js?v=530D27.3-TEST';
    script.onerror=()=>{document.getElementById('app').textContent='Chargement de DEOS interrompu. Les données existantes sont conservées.';};
    document.body.appendChild(script);
  }catch(error){
    console.error('[DEOS TEST startup]',error);
    document.getElementById('app').textContent='Impossible d’ouvrir la copie TEST : '+(error?.message||'stockage indisponible')+'. Les données originales sont conservées.';
  }
})();
