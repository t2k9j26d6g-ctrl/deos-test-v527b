(function initDeosRemoteAdapter(global) {
  const supabaseApi = global.DeosSupabase || {};
  const createRemoteError = typeof supabaseApi.createRemoteError === "function"
    ? supabaseApi.createRemoteError
    : (code, message, details) => ({ code, message, details: details || null });
  const ALLOWED_TEST_PAYLOAD_KEYS = new Set(["scenario", "device", "note", "timestamp", "status", "conflictToken", "client"]);
  const FORBIDDEN_LINK_KEYS = new Set([
    "actions",
    "managers",
    "projects",
    "decisions",
    "priorities",
    "activity",
    "journal",
    "documents",
    "agenda",
    "folders",
    "performance",
    "meetingPreparations",
    "performance_imports",
    "state",
    "settings",
    "remoteSync"
  ]);
  const RESERVED_DEOS_KEYS = new Set([
    "actions",
    "managers",
    "projects",
    "decisions",
    "priorities",
    "activity",
    "journal",
    "documents",
    "agenda",
    "folders",
    "performance",
    "meetingPreparations",
    "links",
    "performance_imports",
    "deos_actions",
    "deos_managers",
    "deos_projects",
    "deos_decisions",
    "deos_priorities",
    "deos_activity",
    "deos_journal",
    "deos_documents",
    "deos_agenda",
    "deos_folders",
    "deos_performance",
    "deos_meetingPreparations",
    "deos_links",
    "deos_performance_imports"
  ]);

  function clonePlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return JSON.parse(JSON.stringify(value));
  }

  function validatePayloadShape(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw createRemoteError("INVALID_TEST_PAYLOAD", "Le payload distant doit rester un objet de test simple.");
    }
    for (const key of Object.keys(payload)) {
      if (RESERVED_DEOS_KEYS.has(key) || !ALLOWED_TEST_PAYLOAD_KEYS.has(key)) {
        throw createRemoteError("TEST_ONLY_GUARD", `La cle ${key} n'est pas autorisee dans le mode distant V5.21C.`);
      }
    }
  }

  function normalizeLabel(label) {
    const value = String(label || "").trim();
    if (!/^test\b/i.test(value)) {
      throw createRemoteError("TEST_ONLY_LABEL_REQUIRED", "Seuls des enregistrements de test explicites sont autorises dans cette version.");
    }
    return value;
  }

  function normalizeLinkData(link) {
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw createRemoteError("INVALID_LINK_PAYLOAD", "Le payload distant d'un Lien doit rester un objet simple.");
    }
    const output = {};
    for (const [key, value] of Object.entries(link)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey === "id" || normalizedKey === "clientId") continue;
      if (normalizedKey.startsWith("__") || normalizedKey.startsWith("_sync") || FORBIDDEN_LINK_KEYS.has(normalizedKey) || RESERVED_DEOS_KEYS.has(normalizedKey)) {
        throw createRemoteError("LINK_PAYLOAD_FORBIDDEN", `La cle ${normalizedKey} n'est pas autorisee pour la synchronisation Liens.`);
      }
      output[normalizedKey] = value;
    }
    return clonePlainObject(output);
  }

  function normalizeLinkRow(row) {
    const data = row && row.data && typeof row.data === "object" && !Array.isArray(row.data) ? clonePlainObject(row.data) : {};
    return {
      remoteId: row && row.id ? String(row.id) : "",
      clientId: row && row.client_id ? String(row.client_id) : String(data.id || ""),
      ownerId: row && row.owner_id ? String(row.owner_id) : "",
      workspaceId: row && row.workspace_id ? String(row.workspace_id) : "",
      version: Number.isFinite(Number(row && row.version)) ? Number(row.version) : 0,
      createdAt: row && row.created_at ? String(row.created_at) : "",
      updatedAt: row && row.updated_at ? String(row.updated_at) : "",
      deletedAt: row && row.deleted_at ? String(row.deleted_at) : "",
      link: {
        id: row && row.client_id ? String(row.client_id) : String(data.id || ""),
        ...data
      }
    };
  }

  function normalizeActionData(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw createRemoteError("INVALID_ACTION_PAYLOAD", "Le payload distant d'une Action doit rester un objet simple.");
    }
    const output = {};
    for (const [key, value] of Object.entries(action)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey === "id" || normalizedKey === "clientId") continue;
      if (normalizedKey.startsWith("__") || normalizedKey.startsWith("_sync") || RESERVED_DEOS_KEYS.has(normalizedKey)) {
        throw createRemoteError("ACTION_PAYLOAD_FORBIDDEN", `La cle ${normalizedKey} n'est pas autorisee pour la synchronisation Actions.`);
      }
      output[normalizedKey] = value;
    }
    return clonePlainObject(output);
  }

  function normalizeActionRow(row) {
    const data = row && row.data && typeof row.data === "object" && !Array.isArray(row.data) ? clonePlainObject(row.data) : {};
    return {
      remoteId: row && row.id ? String(row.id) : "",
      clientId: row && row.client_id ? String(row.client_id) : String(data.id || ""),
      ownerId: row && row.owner_id ? String(row.owner_id) : "",
      workspaceId: row && row.workspace_id ? String(row.workspace_id) : "",
      version: Number.isFinite(Number(row && row.version)) ? Number(row.version) : 0,
      createdAt: row && row.created_at ? String(row.created_at) : "",
      updatedAt: row && row.updated_at ? String(row.updated_at) : "",
      deletedAt: row && row.deleted_at ? String(row.deleted_at) : "",
      action: { id: row && row.client_id ? String(row.client_id) : String(data.id || ""), ...data }
    };
  }

  function normalizeProjectData(project) {
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      throw createRemoteError("INVALID_PROJECT_PAYLOAD", "Le payload distant d'un Projet doit rester un objet simple.");
    }
    const output = {};
    for (const [key, value] of Object.entries(project)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey === "id" || normalizedKey === "clientId") continue;
      if (normalizedKey.startsWith("__") || normalizedKey.startsWith("_sync") || (RESERVED_DEOS_KEYS.has(normalizedKey) && !["actions", "decisions"].includes(normalizedKey))) {
        throw createRemoteError("PROJECT_PAYLOAD_FORBIDDEN", `La cle ${normalizedKey} n'est pas autorisee pour la synchronisation Projets.`);
      }
      output[normalizedKey] = value;
    }
    return clonePlainObject(output);
  }

  function normalizeProjectRow(row) {
    const data = row && row.data && typeof row.data === "object" && !Array.isArray(row.data) ? clonePlainObject(row.data) : {};
    return {
      remoteId: row && row.id ? String(row.id) : "",
      clientId: row && row.client_id ? String(row.client_id) : String(data.id || ""),
      ownerId: row && row.owner_id ? String(row.owner_id) : "",
      workspaceId: row && row.workspace_id ? String(row.workspace_id) : "",
      version: Number.isFinite(Number(row && row.version)) ? Number(row.version) : 0,
      createdAt: row && row.created_at ? String(row.created_at) : "",
      updatedAt: row && row.updated_at ? String(row.updated_at) : "",
      deletedAt: row && row.deleted_at ? String(row.deleted_at) : "",
      project: { id: row && row.client_id ? String(row.client_id) : String(data.id || ""), ...data }
    };
  }

  function normalizeDecisionData(decision) {
    if (!decision || typeof decision !== "object" || Array.isArray(decision)) throw createRemoteError("INVALID_DECISION_PAYLOAD", "Le payload distant d'une Décision doit rester un objet simple.");
    const output = {};
    for (const [key,value] of Object.entries(decision)) {
      const k=String(key||"").trim(); if(!k||k==="id"||k==="clientId") continue;
      if(k.startsWith("__")||k.startsWith("_sync")||RESERVED_DEOS_KEYS.has(k)) throw createRemoteError("DECISION_PAYLOAD_FORBIDDEN", `La cle ${k} n'est pas autorisee pour la synchronisation Décisions.`);
      output[k]=value;
    }
    return clonePlainObject(output);
  }
  function normalizeDecisionRow(row) {
    const data=row&&row.data&&typeof row.data==="object"&&!Array.isArray(row.data)?clonePlainObject(row.data):{};
    return {remoteId:row?.id?String(row.id):"",clientId:row?.client_id?String(row.client_id):String(data.id||""),ownerId:row?.owner_id?String(row.owner_id):"",workspaceId:row?.workspace_id?String(row.workspace_id):"",version:Number.isFinite(Number(row?.version))?Number(row.version):0,createdAt:row?.created_at?String(row.created_at):"",updatedAt:row?.updated_at?String(row.updated_at):"",deletedAt:row?.deleted_at?String(row.deleted_at):"",decision:{id:row?.client_id?String(row.client_id):String(data.id||""),...data}};
  }
  function normalizeDocumentData(documentData) {
    if (!documentData || typeof documentData !== "object" || Array.isArray(documentData)) throw createRemoteError("INVALID_DOCUMENT_PAYLOAD", "Le payload distant d'un Document doit rester un objet simple.");
    const output={};
    for(const [key,value] of Object.entries(documentData)){
      const k=String(key||"").trim(); if(!k||k==="id"||k==="clientId")continue;
      if(k.startsWith("__")||k.startsWith("_sync")||RESERVED_DEOS_KEYS.has(k)) throw createRemoteError("DOCUMENT_PAYLOAD_FORBIDDEN", `La cle ${k} n'est pas autorisee pour la synchronisation Documents.`);
      output[k]=value;
    }
    return clonePlainObject(output);
  }
  function normalizeDocumentRow(row){
    const data=row&&row.data&&typeof row.data==="object"&&!Array.isArray(row.data)?clonePlainObject(row.data):{};
    return {remoteId:row?.id?String(row.id):"",clientId:row?.client_id?String(row.client_id):String(data.id||""),ownerId:row?.owner_id?String(row.owner_id):"",workspaceId:row?.workspace_id?String(row.workspace_id):"",version:Number.isFinite(Number(row?.version))?Number(row.version):0,createdAt:row?.created_at?String(row.created_at):"",updatedAt:row?.updated_at?String(row.updated_at):"",deletedAt:row?.deleted_at?String(row.deleted_at):"",document:{id:row?.client_id?String(row.client_id):String(data.id||""),...data}};
  }

  function normalizeRecord(record, expectedWorkspaceId, ownerId) {
    const payload = clonePlainObject(record.payload || {});
    validatePayloadShape(payload);
    return {
      workspace_id: expectedWorkspaceId,
      owner_id: ownerId,
      label: normalizeLabel(record.label),
      payload,
      version: Number.isFinite(Number(record.version)) ? Number(record.version) : 1,
      deleted_at: record.deleted_at || null
    };
  }

  function normalizeFolderData(folder) {
    if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
      throw createRemoteError("INVALID_PROJECT_PAYLOAD", "Le payload distant d'un Projet doit rester un objet simple.");
    }
    const output = {};
    for (const [key, value] of Object.entries(folder)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey === "id" || normalizedKey === "clientId") continue;
      if (normalizedKey.startsWith("__") || normalizedKey.startsWith("_sync") || (RESERVED_DEOS_KEYS.has(normalizedKey) && !["actions", "decisions"].includes(normalizedKey))) {
        throw createRemoteError("PROJECT_PAYLOAD_FORBIDDEN", `La cle ${normalizedKey} n'est pas autorisee pour la synchronisation Projets.`);
      }
      output[normalizedKey] = value;
    }
    return clonePlainObject(output);
  }

  function normalizeFolderRow(row) {
    const data = row && row.data && typeof row.data === "object" && !Array.isArray(row.data) ? clonePlainObject(row.data) : {};
    return {
      remoteId: row && row.id ? String(row.id) : "",
      clientId: row && row.client_id ? String(row.client_id) : String(data.id || ""),
      ownerId: row && row.owner_id ? String(row.owner_id) : "",
      workspaceId: row && row.workspace_id ? String(row.workspace_id) : "",
      version: Number.isFinite(Number(row && row.version)) ? Number(row.version) : 0,
      createdAt: row && row.created_at ? String(row.created_at) : "",
      updatedAt: row && row.updated_at ? String(row.updated_at) : "",
      deletedAt: row && row.deleted_at ? String(row.deleted_at) : "",
      folder: { id: row && row.client_id ? String(row.client_id) : String(data.id || ""), ...data }
    };
  }

  function normalizeManagerData(manager) {
    if (!manager || typeof manager !== "object" || Array.isArray(manager)) {
      throw createRemoteError("INVALID_MANAGER_PAYLOAD", "Le payload distant d'un Manager doit rester un objet simple.");
    }
    const output = {};
    for (const [key, value] of Object.entries(manager)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey === "id" || normalizedKey === "clientId") continue;
      // `actions` est un champ métier légitime de la fiche Manager.
      if (normalizedKey.startsWith("__") || normalizedKey.startsWith("_sync") || (RESERVED_DEOS_KEYS.has(normalizedKey) && normalizedKey !== "actions")) {
        throw createRemoteError("MANAGER_PAYLOAD_FORBIDDEN", `La cle ${normalizedKey} n'est pas autorisee pour la synchronisation Managers.`);
      }
      output[normalizedKey] = value;
    }
    return clonePlainObject(output);
  }

  function normalizeManagerRow(row) {
    const data = row && row.data && typeof row.data === "object" && !Array.isArray(row.data) ? clonePlainObject(row.data) : {};
    return {
      remoteId: row && row.id ? String(row.id) : "",
      clientId: row && row.client_id ? String(row.client_id) : String(data.id || ""),
      ownerId: row && row.owner_id ? String(row.owner_id) : "",
      workspaceId: row && row.workspace_id ? String(row.workspace_id) : "",
      version: Number.isFinite(Number(row && row.version)) ? Number(row.version) : 0,
      createdAt: row && row.created_at ? String(row.created_at) : "",
      updatedAt: row && row.updated_at ? String(row.updated_at) : "",
      deletedAt: row && row.deleted_at ? String(row.deleted_at) : "",
      manager: { id: row && row.client_id ? String(row.client_id) : String(data.id || ""), ...data }
    };
  }

  function normalizeRecord(record, expectedWorkspaceId, ownerId) {
    const payload = clonePlainObject(record.payload || {});
    validatePayloadShape(payload);
    return {
      workspace_id: expectedWorkspaceId,
      owner_id: ownerId,
      label: normalizeLabel(record.label),
      payload,
      version: Number.isFinite(Number(record.version)) ? Number(record.version) : 1,
      deleted_at: record.deleted_at || null
    };
  }

  
class SupabaseRemoteAdapter {
    constructor(authService, options = {}) {
      this.authService = authService;
      this.debug = Boolean(options.debug);
    }

    getContext(workspaceId) {
      if (!this.authService || !this.authService.getClient || !this.authService.getClient()) {
        throw createRemoteError("REMOTE_CLIENT_UNAVAILABLE", "Client distant indisponible.");
      }
      if (!this.authService.isAuthenticated || !this.authService.isAuthenticated()) {
        throw createRemoteError("AUTH_REQUIRED", "Authentification requise pour le mode distant.");
      }
      const user = this.authService.getCurrentUser();
      const context = this.authService.getWorkspaceContext ? this.authService.getWorkspaceContext() : {};
      const activeWorkspaceId = context.workspace && context.workspace.id ? String(context.workspace.id) : "";
      const role = String(context.role || "").toLowerCase();
      if (!activeWorkspaceId) {
        throw createRemoteError("WORKSPACE_REQUIRED", "Aucun workspace distant n'est actif pour cet utilisateur.");
      }
      if (workspaceId && String(workspaceId) !== activeWorkspaceId) {
        throw createRemoteError("WORKSPACE_OVERRIDE_FORBIDDEN", "Le frontend ne peut pas viser un autre workspace dans cette version.");
      }
      return {
        client: this.authService.getClient(),
        workspaceId: activeWorkspaceId,
        userId: user && user.id ? String(user.id) : "",
        role
      };
    }

    assertWritableRole(role) {
      if (["owner", "admin", "contributor"].includes(String(role || "").toLowerCase())) return;
      throw createRemoteError("FORBIDDEN_ROLE", "Ce role distant ne peut pas ecrire dans les enregistrements de test.");
    }

    assertLinksOnlyMode() {
      return true;
    }

    async listTestRecords(workspaceId) {
      const context = this.getContext(workspaceId);
      const response = await context.client
        .from("deos_test_records")
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (response.error) throw createRemoteError("REMOTE_LIST_FAILED", response.error.message || "Lecture distante impossible.");
      return Array.isArray(response.data) ? response.data : [];
    }

    async getTestRecord(id) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_test_records")
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_GET_FAILED", response.error.message || "Lecture du record impossible.");
      return response.data || null;
    }

    async createTestRecord(data) {
      const context = this.getContext(data && data.workspaceId);
      this.assertWritableRole(context.role);
      const record = normalizeRecord(data || {}, context.workspaceId, context.userId);
      const response = await context.client
        .from("deos_test_records")
        .insert(record)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) throw createRemoteError("REMOTE_CREATE_FAILED", response.error.message || "Creation distante impossible.");
      return response.data;
    }

    async updateTestRecord(id, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) {
        throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour une mise a jour distante.");
      }
      const payload = patch && Object.prototype.hasOwnProperty.call(patch, "payload")
        ? clonePlainObject(patch.payload)
        : undefined;
      if (payload !== undefined) validatePayloadShape(payload);
      const label = patch && Object.prototype.hasOwnProperty.call(patch, "label") ? normalizeLabel(patch.label) : undefined;
      const updatePayload = {
        version: version + 1,
        updated_at: new Date().toISOString()
      };
      if (payload !== undefined) updatePayload.payload = payload;
      if (label !== undefined) updatePayload.label = label;
      const response = await context.client
        .from("deos_test_records")
        .update(updatePayload)
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .eq("version", version)
        .is("deleted_at", null)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_UPDATE_FAILED", response.error.message || "Mise a jour distante impossible.");
      if (response.data) return response.data;
      const current = await this.getTestRecord(id);
      if (current && Number(current.version) !== version) {
        throw createRemoteError("CONFLICT", "Le record distant a change depuis votre derniere lecture.", {
          currentVersion: Number(current.version || 0)
        });
      }
      throw createRemoteError("REMOTE_RECORD_NOT_FOUND", "Record distant introuvable ou deja supprime.");
    }

    async softDeleteTestRecord(id, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const current = await this.getTestRecord(id);
      if (!current) throw createRemoteError("REMOTE_RECORD_NOT_FOUND", "Record distant introuvable.");
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version !== Number(current.version)) {
        throw createRemoteError("CONFLICT", "Le record distant a change avant suppression logique.", {
          currentVersion: Number(current.version || 0)
        });
      }
      const response = await context.client
        .from("deos_test_records")
        .update({
          deleted_at: new Date().toISOString(),
          version: version + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("workspace_id", context.workspaceId)
        .eq("version", version)
        .is("deleted_at", null)
        .select("id, workspace_id, owner_id, label, payload, created_at, updated_at, deleted_at, version")
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_DELETE_FAILED", response.error.message || "Suppression logique impossible.");
      if (response.data) return response.data;
      throw createRemoteError("CONFLICT", "Le record distant a ete modifie avant suppression logique.");
    }

    async listLinks(workspaceId) {
      this.assertLinksOnlyMode();
      const context = this.getContext(workspaceId);
      const response = await context.client
        .from("deos_links")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .order("updated_at", { ascending: false });
      if (response.error) throw createRemoteError("REMOTE_LINKS_LIST_FAILED", response.error.message || "Lecture distante des Liens impossible.");
      return Array.isArray(response.data) ? response.data.map(normalizeLinkRow) : [];
    }

    async getLink(clientId) {
      this.assertLinksOnlyMode();
      const context = this.getContext();
      const response = await context.client
        .from("deos_links")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .eq("client_id", String(clientId || ""))
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_LINK_GET_FAILED", response.error.message || "Lecture distante du Lien impossible.");
      return response.data ? normalizeLinkRow(response.data) : null;
    }

    async createLink(link) {
      this.assertLinksOnlyMode();
      const context = this.getContext(link && link.workspaceId);
      this.assertWritableRole(context.role);
      const clientId = String(link && link.id ? link.id : "").trim();
      if (!clientId) throw createRemoteError("LINK_CLIENT_ID_REQUIRED", "Un id local stable est requis pour créer un Lien distant.");
      const payload = normalizeLinkData(link || {});
      const response = await context.client
        .from("deos_links")
        .insert({
          workspace_id: context.workspaceId,
          owner_id: context.userId,
          client_id: clientId,
          data: payload
        })
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) {
        const code = String(response.error.code || "").trim();
        if (code === "23505") throw createRemoteError("REMOTE_LINK_EXISTS", response.error.message || "Le Lien existe déjà à distance.", response.error);
        throw createRemoteError("REMOTE_LINK_CREATE_FAILED", response.error.message || "Création distante du Lien impossible.", response.error);
      }
      return normalizeLinkRow(response.data);
    }

    async updateLink(clientId, patch, expectedVersion) {
      this.assertLinksOnlyMode();
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) {
        throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour mettre à jour un Lien distant.");
      }
      const payload = normalizeLinkData(patch || {});
      const response = await context.client.rpc("deos_update_link", {
        p_client_id: String(clientId || "").trim(),
        p_expected_version: version,
        p_data: payload
      });
      if (response.error) {
        const message = response.error.message || "Mise à jour distante du Lien impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_LINK_UPDATE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeLinkRow(row || {});
    }

    async softDeleteLink(clientId, expectedVersion) {
      this.assertLinksOnlyMode();
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) {
        throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour supprimer logiquement un Lien distant.");
      }
      const response = await context.client.rpc("deos_soft_delete_link", {
        p_client_id: String(clientId || "").trim(),
        p_expected_version: version
      });
      if (response.error) {
        const message = response.error.message || "Suppression logique distante du Lien impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_LINK_DELETE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeLinkRow(row || {});
    }

    async listActions(workspaceId) {
      const context = this.getContext(workspaceId);
      const response = await context.client
        .from("deos_actions")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .order("updated_at", { ascending: false });
      if (response.error) throw createRemoteError("REMOTE_ACTIONS_LIST_FAILED", response.error.message || "Lecture distante des Actions impossible.");
      return Array.isArray(response.data) ? response.data.map(normalizeActionRow) : [];
    }

    async getAction(clientId) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_actions")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .eq("client_id", String(clientId || ""))
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_ACTION_GET_FAILED", response.error.message || "Lecture distante de l'Action impossible.");
      return response.data ? normalizeActionRow(response.data) : null;
    }

    async createAction(action) {
      const context = this.getContext(action && action.workspaceId);
      this.assertWritableRole(context.role);
      const clientId = String(action && (action.clientId || action.id) ? (action.clientId || action.id) : "").trim();
      if (!clientId) throw createRemoteError("ACTION_CLIENT_ID_REQUIRED", "Un id local stable est requis pour créer une Action distante.");
      const payload = normalizeActionData(action || {});
      const response = await context.client
        .from("deos_actions")
        .insert({ workspace_id: context.workspaceId, owner_id: context.userId, client_id: clientId, data: payload })
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) {
        const code = String(response.error.code || "").trim();
        if (code === "23505") {
          // V5.30K — même protection que pour Projets : un enregistrement distant
          // peut déjà porter ce client_id (y compris après soft-delete). On le
          // réutilise/restaure au lieu de provoquer une nouvelle erreur de clé unique.
          const existing = await context.client
            .from("deos_actions")
            .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
            .eq("workspace_id", context.workspaceId)
            .eq("client_id", clientId)
            .maybeSingle();
          if (existing.error) throw createRemoteError("REMOTE_ACTION_EXISTS_LOOKUP_FAILED", existing.error.message || "L'Action existe déjà mais sa lecture a échoué.", existing.error);
          if (existing.data && !existing.data.deleted_at) return normalizeActionRow(existing.data);
          if (existing.data && existing.data.deleted_at) {
            const restored = await context.client
              .from("deos_actions")
              .update({ owner_id: context.userId, data: payload, deleted_at: null })
              .eq("workspace_id", context.workspaceId)
              .eq("client_id", clientId)
              .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
              .single();
            if (restored.error) throw createRemoteError("REMOTE_ACTION_RESTORE_FAILED", restored.error.message || "Restauration de l'Action distante impossible.", restored.error);
            return normalizeActionRow(restored.data);
          }
          throw createRemoteError("REMOTE_ACTION_EXISTS", response.error.message || "L'Action existe déjà à distance.", response.error);
        }
        throw createRemoteError("REMOTE_ACTION_CREATE_FAILED", response.error.message || "Création distante de l'Action impossible.", response.error);
      }
      return normalizeActionRow(response.data);
    }

    async updateAction(clientId, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour mettre à jour une Action distante.");
      const payload = normalizeActionData(patch || {});
      const response = await context.client.rpc("deos_update_action", { p_client_id: String(clientId || "").trim(), p_expected_version: version, p_data: payload });
      if (response.error) {
        const message = response.error.message || "Mise à jour distante de l'Action impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_ACTION_UPDATE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeActionRow(row || {});
    }

    async softDeleteAction(clientId, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour supprimer logiquement une Action distante.");
      const response = await context.client.rpc("deos_soft_delete_action", { p_client_id: String(clientId || "").trim(), p_expected_version: version });
      if (response.error) {
        const message = response.error.message || "Suppression logique distante de l'Action impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_ACTION_DELETE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeActionRow(row || {});
    }

    async listProjects(workspaceId) {
      const context = this.getContext(workspaceId);
      // V5.23B : lecture via RPC dédiée. Cela évite le chemin SELECT direct
      // qui pouvait rester bloqué avec PostgREST/RLS sur la table nouvellement créée.
      const response = await context.client.rpc("deos_list_projects");
      if (response.error) {
        throw createRemoteError(
          "REMOTE_PROJECTS_LIST_FAILED",
          response.error.message || "Lecture distante des Projets impossible.",
          response.error
        );
      }
      return Array.isArray(response.data) ? response.data.map(normalizeProjectRow) : [];
    }

    async getProject(clientId) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_projects")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .eq("client_id", String(clientId || ""))
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_PROJECT_GET_FAILED", response.error.message || "Lecture distante du Projet impossible.");
      return response.data ? normalizeProjectRow(response.data) : null;
    }

    async createProject(project) {
      const context = this.getContext(project && project.workspaceId);
      this.assertWritableRole(context.role);
      const clientId = String(project && (project.clientId || project.id) ? (project.clientId || project.id) : "").trim();
      if (!clientId) throw createRemoteError("PROJECT_CLIENT_ID_REQUIRED", "Un id local stable est requis pour créer un Projet distante.");
      const payload = normalizeProjectData(project || {});
      const response = await context.client
        .from("deos_projects")
        .insert({ workspace_id: context.workspaceId, owner_id: context.userId, client_id: clientId, data: payload })
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) {
        const code = String(response.error.code || "").trim();
        if (code === "23505") {
          // V5.30F — un ancien enregistrement (y compris soft-deleted) peut déjà porter
          // le même client_id. On le réutilise au lieu de tenter une seconde insertion.
          const existing = await context.client
            .from("deos_projects")
            .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
            .eq("workspace_id", context.workspaceId)
            .eq("client_id", clientId)
            .maybeSingle();
          if (existing.error) throw createRemoteError("REMOTE_PROJECT_EXISTS_LOOKUP_FAILED", existing.error.message || "Le Projet existe déjà mais sa lecture a échoué.", existing.error);
          if (existing.data && !existing.data.deleted_at) return normalizeProjectRow(existing.data);
          if (existing.data && existing.data.deleted_at) {
            const restored = await context.client
              .from("deos_projects")
              .update({ owner_id: context.userId, data: payload, deleted_at: null })
              .eq("workspace_id", context.workspaceId)
              .eq("client_id", clientId)
              .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
              .single();
            if (restored.error) throw createRemoteError("REMOTE_PROJECT_RESTORE_FAILED", restored.error.message || "Restauration du Projet distant impossible.", restored.error);
            return normalizeProjectRow(restored.data);
          }
          throw createRemoteError("REMOTE_PROJECT_EXISTS", response.error.message || "Le Projet existe déjà à distance.", response.error);
        }
        throw createRemoteError("REMOTE_PROJECT_CREATE_FAILED", response.error.message || "Création distante du Projet impossible.", response.error);
      }
      return normalizeProjectRow(response.data);
    }

    async updateProject(clientId, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour mettre à jour un Projet distante.");
      const payload = normalizeProjectData(patch || {});
      const response = await context.client.rpc("deos_update_project", { p_client_id: String(clientId || "").trim(), p_expected_version: version, p_data: payload });
      if (response.error) {
        const message = response.error.message || "Mise à jour distante du Projet impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_PROJECT_UPDATE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeProjectRow(row || {});
    }

    async softDeleteProject(clientId, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour supprimer logiquement un Projet distante.");
      const response = await context.client.rpc("deos_soft_delete_project", { p_client_id: String(clientId || "").trim(), p_expected_version: version });
      if (response.error) {
        const message = response.error.message || "Suppression logique distante du Projet impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_PROJECT_DELETE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeProjectRow(row || {});
    }
    async listFolders(workspaceId) {
      const context = this.getContext(workspaceId);
      // V5.23B : lecture via RPC dédiée. Cela évite le chemin SELECT direct
      // qui pouvait rester bloqué avec PostgREST/RLS sur la table nouvellement créée.
      const response = await context.client.rpc("deos_list_folders");
      if (response.error) {
        throw createRemoteError(
          "REMOTE_PROJECTS_LIST_FAILED",
          response.error.message || "Lecture distante des Projets impossible.",
          response.error
        );
      }
      return Array.isArray(response.data) ? response.data.map(normalizeFolderRow) : [];
    }

    async getFolder(clientId) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_folders")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .eq("client_id", String(clientId || ""))
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_PROJECT_GET_FAILED", response.error.message || "Lecture distante du Projet impossible.");
      return response.data ? normalizeFolderRow(response.data) : null;
    }

    async createFolder(folder) {
      const context = this.getContext(folder && folder.workspaceId);
      this.assertWritableRole(context.role);
      const clientId = String(folder && (folder.clientId || folder.id) ? (folder.clientId || folder.id) : "").trim();
      if (!clientId) throw createRemoteError("PROJECT_CLIENT_ID_REQUIRED", "Un id local stable est requis pour créer un Projet distante.");
      const payload = normalizeFolderData(folder || {});
      const response = await context.client
        .from("deos_folders")
        .insert({ workspace_id: context.workspaceId, owner_id: context.userId, client_id: clientId, data: payload })
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) {
        const code = String(response.error.code || "").trim();
        if (code === "23505") throw createRemoteError("REMOTE_PROJECT_EXISTS", response.error.message || "Le Projet existe déjà à distance.", response.error);
        throw createRemoteError("REMOTE_PROJECT_CREATE_FAILED", response.error.message || "Création distante du Projet impossible.", response.error);
      }
      return normalizeFolderRow(response.data);
    }

    async updateFolder(clientId, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour mettre à jour un Projet distante.");
      const payload = normalizeFolderData(patch || {});
      const response = await context.client.rpc("deos_update_folder", { p_client_id: String(clientId || "").trim(), p_expected_version: version, p_data: payload });
      if (response.error) {
        const message = response.error.message || "Mise à jour distante du Projet impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_PROJECT_UPDATE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeFolderRow(row || {});
    }

    async softDeleteFolder(clientId, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour supprimer logiquement un Projet distante.");
      const response = await context.client.rpc("deos_soft_delete_folder", { p_client_id: String(clientId || "").trim(), p_expected_version: version });
      if (response.error) {
        const message = response.error.message || "Suppression logique distante du Projet impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_PROJECT_DELETE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeFolderRow(row || {});
    }

    async listManagers(workspaceId) {
      const context = this.getContext(workspaceId);
      const response = await context.client.rpc("deos_list_managers");
      if (response.error) {
        throw createRemoteError("REMOTE_MANAGERS_LIST_FAILED", response.error.message || "Lecture distante des Managers impossible.", response.error);
      }
      return Array.isArray(response.data) ? response.data.map(normalizeManagerRow) : [];
    }

    async getManager(clientId) {
      const context = this.getContext();
      const response = await context.client
        .from("deos_managers")
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .eq("workspace_id", context.workspaceId)
        .eq("client_id", String(clientId || ""))
        .maybeSingle();
      if (response.error) throw createRemoteError("REMOTE_MANAGER_GET_FAILED", response.error.message || "Lecture distante du Manager impossible.", response.error);
      return response.data ? normalizeManagerRow(response.data) : null;
    }

    async createManager(manager) {
      const context = this.getContext(manager && manager.workspaceId);
      this.assertWritableRole(context.role);
      const clientId = String(manager && (manager.clientId || manager.id) ? (manager.clientId || manager.id) : "").trim();
      if (!clientId) throw createRemoteError("MANAGER_CLIENT_ID_REQUIRED", "Un id local stable est requis pour créer un Manager distant.");
      const payload = normalizeManagerData(manager || {});
      const response = await context.client
        .from("deos_managers")
        .insert({ workspace_id: context.workspaceId, owner_id: context.userId, client_id: clientId, data: payload })
        .select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version")
        .single();
      if (response.error) {
        const code = String(response.error.code || "").trim();
        if (code === "23505") throw createRemoteError("REMOTE_MANAGER_EXISTS", response.error.message || "Le Manager existe déjà à distance.", response.error);
        throw createRemoteError("REMOTE_MANAGER_CREATE_FAILED", response.error.message || "Création distante du Manager impossible.", response.error);
      }
      return normalizeManagerRow(response.data);
    }

    async updateManager(clientId, patch, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour mettre à jour un Manager distant.");
      const payload = normalizeManagerData(patch || {});
      const response = await context.client.rpc("deos_update_manager", { p_client_id: String(clientId || "").trim(), p_expected_version: version, p_data: payload });
      if (response.error) {
        const message = response.error.message || "Mise à jour distante du Manager impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_MANAGER_UPDATE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeManagerRow(row || {});
    }

    async softDeleteManager(clientId, expectedVersion) {
      const context = this.getContext();
      this.assertWritableRole(context.role);
      const version = Number(expectedVersion);
      if (!Number.isInteger(version) || version < 1) throw createRemoteError("EXPECTED_VERSION_REQUIRED", "La version attendue est obligatoire pour supprimer logiquement un Manager distant.");
      const response = await context.client.rpc("deos_soft_delete_manager", { p_client_id: String(clientId || "").trim(), p_expected_version: version });
      if (response.error) {
        const message = response.error.message || "Suppression logique distante du Manager impossible.";
        if (/CONFLICT/i.test(message)) throw createRemoteError("CONFLICT", message, response.error);
        throw createRemoteError("REMOTE_MANAGER_DELETE_FAILED", message, response.error);
      }
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return normalizeManagerRow(row || {});
    }
    async listDecisions(workspaceId) {
      const context=this.getContext(workspaceId); const response=await context.client.rpc("deos_list_decisions");
      if(response.error) throw createRemoteError("REMOTE_DECISIONS_LIST_FAILED",response.error.message||"Lecture distante des Décisions impossible.",response.error);
      return Array.isArray(response.data)?response.data.map(normalizeDecisionRow):[];
    }
    async createDecision(decision){const context=this.getContext(decision&&decision.workspaceId);this.assertWritableRole(context.role);const clientId=String(decision&&(decision.clientId||decision.id)||"").trim();if(!clientId)throw createRemoteError("DECISION_CLIENT_ID_REQUIRED","Un id local stable est requis.");const payload=normalizeDecisionData(decision||{});const response=await context.client.from("deos_decisions").insert({workspace_id:context.workspaceId,owner_id:context.userId,client_id:clientId,data:payload}).select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version").single();if(response.error){if(String(response.error.code||"")==="23505")throw createRemoteError("REMOTE_DECISION_EXISTS",response.error.message,response.error);throw createRemoteError("REMOTE_DECISION_CREATE_FAILED",response.error.message||"Création distante Décision impossible.",response.error);}return normalizeDecisionRow(response.data);}
    async updateDecision(clientId,patch,expectedVersion){const context=this.getContext();this.assertWritableRole(context.role);const version=Number(expectedVersion);if(!Number.isInteger(version)||version<1)throw createRemoteError("EXPECTED_VERSION_REQUIRED","Version attendue obligatoire.");const response=await context.client.rpc("deos_update_decision",{p_client_id:String(clientId||"").trim(),p_expected_version:version,p_data:normalizeDecisionData(patch||{})});if(response.error){const message=response.error.message||"Mise à jour distante Décision impossible.";if(/CONFLICT/i.test(message))throw createRemoteError("CONFLICT",message,response.error);throw createRemoteError("REMOTE_DECISION_UPDATE_FAILED",message,response.error);}return normalizeDecisionRow(Array.isArray(response.data)?response.data[0]:response.data||{});}
    async softDeleteDecision(clientId,expectedVersion){const context=this.getContext();this.assertWritableRole(context.role);const version=Number(expectedVersion);if(!Number.isInteger(version)||version<1)throw createRemoteError("EXPECTED_VERSION_REQUIRED","Version attendue obligatoire.");const response=await context.client.rpc("deos_soft_delete_decision",{p_client_id:String(clientId||"").trim(),p_expected_version:version});if(response.error){const message=response.error.message||"Suppression distante Décision impossible.";if(/CONFLICT/i.test(message))throw createRemoteError("CONFLICT",message,response.error);throw createRemoteError("REMOTE_DECISION_DELETE_FAILED",message,response.error);}return normalizeDecisionRow(Array.isArray(response.data)?response.data[0]:response.data||{});}
    async listDocuments(workspaceId){const context=this.getContext(workspaceId);const response=await context.client.rpc("deos_list_documents");if(response.error)throw createRemoteError("REMOTE_DOCUMENTS_LIST_FAILED",response.error.message||"Lecture distante des Documents impossible.",response.error);return Array.isArray(response.data)?response.data.map(normalizeDocumentRow):[];}
    async createDocument(documentData){const context=this.getContext(documentData&&documentData.workspaceId);this.assertWritableRole(context.role);const clientId=String(documentData&&(documentData.clientId||documentData.id)||"").trim();if(!clientId)throw createRemoteError("DOCUMENT_CLIENT_ID_REQUIRED","Un id local stable est requis.");const payload=normalizeDocumentData(documentData||{});const response=await context.client.from("deos_documents").insert({workspace_id:context.workspaceId,owner_id:context.userId,client_id:clientId,data:payload}).select("id, workspace_id, owner_id, client_id, data, created_at, updated_at, deleted_at, version").single();if(response.error){if(String(response.error.code||"")==="23505")throw createRemoteError("REMOTE_DOCUMENT_EXISTS",response.error.message,response.error);throw createRemoteError("REMOTE_DOCUMENT_CREATE_FAILED",response.error.message||"Création distante Document impossible.",response.error);}return normalizeDocumentRow(response.data);}
    async updateDocument(clientId,patch,expectedVersion){const context=this.getContext();this.assertWritableRole(context.role);const version=Number(expectedVersion);if(!Number.isInteger(version)||version<1)throw createRemoteError("EXPECTED_VERSION_REQUIRED","Version attendue obligatoire.");const response=await context.client.rpc("deos_update_document",{p_client_id:String(clientId||"").trim(),p_expected_version:version,p_data:normalizeDocumentData(patch||{})});if(response.error){const message=response.error.message||"Mise à jour distante Document impossible.";if(/CONFLICT/i.test(message))throw createRemoteError("CONFLICT",message,response.error);throw createRemoteError("REMOTE_DOCUMENT_UPDATE_FAILED",message,response.error);}return normalizeDocumentRow(Array.isArray(response.data)?response.data[0]:response.data||{});}
    async softDeleteDocument(clientId,expectedVersion){const context=this.getContext();this.assertWritableRole(context.role);const version=Number(expectedVersion);if(!Number.isInteger(version)||version<1)throw createRemoteError("EXPECTED_VERSION_REQUIRED","Version attendue obligatoire.");const response=await context.client.rpc("deos_soft_delete_document",{p_client_id:String(clientId||"").trim(),p_expected_version:version});if(response.error){const message=response.error.message||"Suppression distante Document impossible.";if(/CONFLICT/i.test(message))throw createRemoteError("CONFLICT",message,response.error);throw createRemoteError("REMOTE_DOCUMENT_DELETE_FAILED",message,response.error);}return normalizeDocumentRow(Array.isArray(response.data)?response.data[0]:response.data||{});}
  }

  global.DeosSupabaseRemote = {
    SupabaseRemoteAdapter
  };
})(window);
