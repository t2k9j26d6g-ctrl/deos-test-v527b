// Chargement du référentiel CODIR sur la vue Dossiers existante (aucune écriture).
// Ce module expose un contrôle en lecture seule et ne migre jamais Supabase.
(function(){
  "use strict";
  const key="deos_codir_audit_readonly";
  const counts={folders:13,projects:47};
  window.DeosCodirAudit=Object.freeze({
    inspect(state){
      const folders=Array.isArray(state?.folders)?state.folders:[];
      const projects=Array.isArray(state?.projects)?state.projects:[];
      const result={timestamp:new Date().toISOString(),expected:counts,actual:{folders:folders.filter(x=>!x.archived).length,projects:projects.filter(x=>!x.archived).length},safeToPlan:false};
      result.safeToPlan=result.actual.folders===counts.folders&&result.actual.projects===counts.projects;
      return result;
    }
  });
})();
