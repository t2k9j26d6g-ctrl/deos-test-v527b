/* Wait for durable TEST storage before the existing application reads synchronous repositories. */
(async function(){
  try {
    if(window.DeosTest)await window.DeosTest.loaded;
    const script=document.createElement('script');script.src='app.js?v=530CODIRD26.2';
    script.onerror=()=>{document.getElementById('app').textContent='Chargement de DEOS interrompu. Les données existantes sont conservées.';};
    document.body.appendChild(script);
  }catch(error){
    console.error('[DEOS TEST startup]',error);
    document.getElementById('app').textContent='Impossible d’ouvrir la copie TEST : '+(error?.message||'stockage indisponible')+'. Les données originales sont conservées.';
  }
})();
