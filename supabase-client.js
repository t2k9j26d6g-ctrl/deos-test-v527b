(function initDeosSupabase(global) {
  const DEFAULT_REMOTE_CONFIG = Object.freeze({
    enabled: false,
    provider: "supabase",
    supabaseUrl: "",
    supabasePublishableKey: "",
    environment: "test",
    authRedirectUrl: "",
    debug: false
  });
  const SUPABASE_JS_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.56.0/dist/umd/supabase.min.js";
  let loadPromise = null;

  function normalizeRemoteConfig(value) {
    const source = value && typeof value === "object" ? value : {};
    const environment = String(source.environment || DEFAULT_REMOTE_CONFIG.environment).trim().toLowerCase();
    return {
      enabled: Boolean(source.enabled),
      provider: String(source.provider || DEFAULT_REMOTE_CONFIG.provider).trim().toLowerCase() || "supabase",
      supabaseUrl: String(source.supabaseUrl || "").trim(),
      supabasePublishableKey: String(source.supabasePublishableKey || "").trim(),
      environment: environment || "test",
      authRedirectUrl: String(source.authRedirectUrl || "").trim(),
      debug: Boolean(source.debug)
    };
  }

  function mergeRemoteConfig(baseConfig, overrideConfig) {
    return normalizeRemoteConfig({
      ...normalizeRemoteConfig(baseConfig),
      ...normalizeRemoteConfig(overrideConfig)
    });
  }

  function truncatePublicValue(value, start = 6, end = 4) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= start + end + 3) return text;
    return `${text.slice(0, start)}...${text.slice(-end)}`;
  }

  function maskEmailAddress(value) {
    const email = String(value || "").trim();
    const atIndex = email.indexOf("@");
    if (atIndex <= 1) return email ? `${email.slice(0, 1)}***` : "";
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const maskedLocal = `${local.slice(0, 1)}***${local.slice(-1)}`;
    if (!domain) return maskedLocal;
    const domainParts = domain.split(".");
    const root = domainParts.shift() || "";
    const suffix = domainParts.length ? `.${domainParts.join(".")}` : "";
    const maskedRoot = root.length <= 2 ? `${root.slice(0, 1)}*` : `${root.slice(0, 2)}***${root.slice(-1)}`;
    return `${maskedLocal}@${maskedRoot}${suffix}`;
  }

  function createRemoteError(code, message, details) {
    return {
      code: String(code || "REMOTE_ERROR"),
      message: String(message || "Erreur distante."),
      details: details || null
    };
  }

  function ensureTrailingSlash(url) {
    return String(url || "").endsWith("/") ? String(url || "") : `${String(url || "")}/`;
  }

  function defaultRedirectUrl(config) {
    if (config.authRedirectUrl) return config.authRedirectUrl;
    if (typeof window === "undefined") return "";
    if (!["http:", "https:"].includes(window.location.protocol)) return "";
    return window.location.origin + window.location.pathname;
  }

  function shouldAllowRemoteInitialization(config) {
    if (!config.enabled) return { ok: false, code: "REMOTE_DISABLED", message: "Mode distant desactive." };
    if (config.provider !== "supabase") return { ok: false, code: "REMOTE_PROVIDER_UNSUPPORTED", message: "Fournisseur distant non pris en charge." };
    if (config.environment === "production") return { ok: false, code: "REMOTE_PRODUCTION_LOCKED", message: "Le mode Production reste bloque dans cette version." };
    if (!config.supabaseUrl || !config.supabasePublishableKey) return { ok: false, code: "REMOTE_NOT_CONFIGURED", message: "Configuration Supabase incomplète." };
    if (typeof window !== "undefined" && window.location.protocol === "file:") {
      return { ok: false, code: "REMOTE_FILE_PROTOCOL_UNSUPPORTED", message: "Le mode distant n'est pas active sous file://. Utilisez Live Server ou GitHub Pages." };
    }
    return { ok: true };
  }

  function safeConsole(debug, level, message, extra) {
    if (!debug) return;
    const logger = console[level] || console.log;
    if (extra === undefined) {
      logger.call(console, `[DEOS Remote] ${message}`);
      return;
    }
    logger.call(console, `[DEOS Remote] ${message}`, extra);
  }

  function loadSupabaseBrowserClient(debug) {
    if (global.supabase && typeof global.supabase.createClient === "function") {
      return Promise.resolve(global.supabase);
    }
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById("deos-supabase-browser-client");
      if (existing) {
        existing.addEventListener("load", () => resolve(global.supabase));
        existing.addEventListener("error", () => reject(createRemoteError("SUPABASE_SCRIPT_LOAD_FAILED", "Chargement de la bibliotheque Supabase impossible.")));
        return;
      }
      const script = document.createElement("script");
      script.id = "deos-supabase-browser-client";
      script.src = SUPABASE_JS_CDN_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (global.supabase && typeof global.supabase.createClient === "function") {
          safeConsole(debug, "info", "Bibliotheque Supabase chargee.");
          resolve(global.supabase);
          return;
        }
        reject(createRemoteError("SUPABASE_SCRIPT_GLOBAL_MISSING", "La bibliotheque Supabase chargee ne fournit pas createClient."));
      };
      script.onerror = () => reject(createRemoteError("SUPABASE_SCRIPT_LOAD_FAILED", "Chargement de la bibliotheque Supabase impossible."));
      document.head.appendChild(script);
    }).catch(error => {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  }

  class DeosAuthService {
    constructor(config, options = {}) {
      this.config = normalizeRemoteConfig(config);
      this.options = options || {};
      this.debug = Boolean(this.config.debug || this.options.debug);
      this.workspacePreferenceKey = String(this.options.workspacePreferenceKey || "deos_remote_workspace_preference");
      this.client = null;
      this.initialized = false;
      this.connectionStatus = this.config.enabled ? "pending" : "local_only";
      this.session = null;
      this.user = null;
      this.profile = null;
      this.currentWorkspace = null;
      this.currentSite = null;
      this.currentRole = "";
      this.availableWorkspaces = [];
      this.lastError = null;
      this.lastAuthEvent = "";
      this.listeners = new Set();
      this.supabaseSubscription = null;
    }

    getRedirectUrl() {
      return defaultRedirectUrl(this.config);
    }

    getClient() {
      return this.client;
    }

    isConfigured() {
      return Boolean(this.config.supabaseUrl && this.config.supabasePublishableKey);
    }

    isAuthenticated() {
      return Boolean(this.session && this.user);
    }

    getSession() {
      return this.session;
    }

    getCurrentUser() {
      return this.user;
    }

    getWorkspaceContext() {
      return {
        workspace: this.currentWorkspace,
        site: this.currentSite,
        role: this.currentRole,
        availableWorkspaces: this.availableWorkspaces.map(item => ({ ...item }))
      };
    }

    getWorkspacePreference() {
      if (typeof window === "undefined" || !window.localStorage) return "";
      try {
        return String(window.localStorage.getItem(this.workspacePreferenceKey) || "").trim();
      } catch {
        return "";
      }
    }

    setWorkspacePreference(workspaceId) {
      if (typeof window === "undefined" || !window.localStorage) return;
      try {
        const value = String(workspaceId || "").trim();
        if (!value) {
          window.localStorage.removeItem(this.workspacePreferenceKey);
          return;
        }
        window.localStorage.setItem(this.workspacePreferenceKey, value);
      } catch {
        // Ignore storage preference failures.
      }
    }

    getAvailableWorkspaces() {
      return this.availableWorkspaces.map(item => ({ ...item }));
    }

    requiresWorkspaceSelection() {
      return this.isAuthenticated() && this.availableWorkspaces.length > 1 && !this.currentWorkspace;
    }

    getStateSnapshot() {
      return {
        initialized: this.initialized,
        configured: this.isConfigured(),
        clientReady: Boolean(this.client),
        connectionStatus: this.connectionStatus,
        authenticated: this.isAuthenticated(),
        user: this.user ? { id: this.user.id, email: this.user.email || "" } : null,
        profile: this.profile ? { id: this.profile.id, display_name: this.profile.display_name || "" } : null,
        workspace: this.currentWorkspace ? { ...this.currentWorkspace } : null,
        site: this.currentSite ? { ...this.currentSite } : null,
        role: this.currentRole,
        availableWorkspaces: this.getAvailableWorkspaces(),
        requiresWorkspaceSelection: this.requiresWorkspaceSelection(),
        lastError: this.lastError,
        lastAuthEvent: this.lastAuthEvent
      };
    }

    async initialize() {
      const readiness = shouldAllowRemoteInitialization(this.config);
      if (!readiness.ok) {
        this.initialized = true;
        this.connectionStatus = readiness.code === "REMOTE_DISABLED" ? "local_only" : "not_configured";
        this.lastError = readiness.code === "REMOTE_DISABLED" ? null : createRemoteError(readiness.code, readiness.message);
        return this.getStateSnapshot();
      }

      const library = await loadSupabaseBrowserClient(this.debug);
      const createClient = library && typeof library.createClient === "function" ? library.createClient : null;
      if (!createClient) {
        this.connectionStatus = "error";
        this.lastError = createRemoteError("SUPABASE_CREATE_CLIENT_MISSING", "createClient indisponible apres chargement de la bibliotheque.");
        throw this.lastError;
      }

      this.client = createClient(this.config.supabaseUrl, this.config.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: this.options.storageKey || ((global.location && String(global.location.pathname || "").includes("deos-test-v527b")) ? "sb-deos-test-auth" : "sb-deos-prod-auth")
        },
        global: {
          headers: {
            "X-Client-Info": "deos-v5.30d"
          }
        }
      });

      const sessionResult = await this.client.auth.getSession();
      if (sessionResult.error) {
        this.connectionStatus = "error";
        this.lastError = createRemoteError("AUTH_SESSION_READ_FAILED", sessionResult.error.message || "Lecture de session impossible.");
      } else {
        await this.applySession(sessionResult.data ? sessionResult.data.session : null, "INITIAL_SESSION");
      }

      // Supabase execute onAuthStateChange sous un verrou interne. Le callback doit
      // rendre la main immediatement : toute lecture de profil/workspace est differee.
      const subscription = this.client.auth.onAuthStateChange((event, session) => {
        const eventName = event || "AUTH_STATE_CHANGE";
        setTimeout(async () => {
          try {
            await this.applySession(session || null, eventName);
          } catch (error) {
            this.connectionStatus = "error";
            this.lastError = createRemoteError(error?.code || "AUTH_STATE_APPLY_FAILED", error?.message || "Mise a jour de session impossible.");
          } finally {
            this.emit(eventName);
          }
        }, 0);
      });
      this.supabaseSubscription = subscription && subscription.data ? subscription.data.subscription : null;
      this.initialized = true;
      return this.getStateSnapshot();
    }

    async dispose() {
      if (this.supabaseSubscription && typeof this.supabaseSubscription.unsubscribe === "function") {
        this.supabaseSubscription.unsubscribe();
      }
      this.supabaseSubscription = null;
      this.listeners.clear();
    }

    async applySession(session, eventName) {
      this.lastAuthEvent = String(eventName || "");
      this.session = session || null;
      this.user = session && session.user ? { id: session.user.id, email: session.user.email || "" } : null;
      this.lastError = null;

      if (!this.session) {
        this.connectionStatus = this.config.enabled ? "signed_out" : "local_only";
        this.profile = null;
        this.currentWorkspace = null;
        this.currentSite = null;
        this.currentRole = "";
        this.availableWorkspaces = [];
        return this.getStateSnapshot();
      }

      try {
        // session.user est deja fourni par Supabase apres getSession/signInWithPassword.
        // Ne pas refaire getUser() evite une requete auth reseau et un risque de blocage.
        if (!this.user) {
          this.connectionStatus = "session_expired";
          this.lastError = createRemoteError("AUTH_USER_MISSING", "Session presente mais utilisateur absent.");
          return this.getStateSnapshot();
        }
        await this.refreshContext();
        this.connectionStatus = "authenticated";
      } catch (error) {
        this.connectionStatus = "error";
        this.lastError = createRemoteError(error.code || "AUTH_APPLY_FAILED", error.message || "Initialisation auth impossible.");
      }
      return this.getStateSnapshot();
    }

    async refreshContext() {
      if (!this.client || !this.user) {
        this.profile = null;
        this.currentWorkspace = null;
        this.currentSite = null;
        this.currentRole = "";
        this.availableWorkspaces = [];
        return this.getStateSnapshot();
      }

      const [profileResponse, membershipResponse] = await Promise.all([
        this.client.from("profiles").select("id, display_name, created_at, updated_at").eq("id", this.user.id).maybeSingle(),
        this.client.from("workspace_members").select("workspace_id, role, created_at").eq("user_id", this.user.id).order("created_at", { ascending: true })
      ]);
      if (profileResponse.error && profileResponse.error.code !== "PGRST116") {
        this.lastError = createRemoteError("PROFILE_READ_FAILED", profileResponse.error.message || "Lecture du profil impossible.");
      } else {
        this.profile = profileResponse.data || null;
      }
      if (membershipResponse.error) {
        this.lastError = createRemoteError("WORKSPACE_MEMBERS_READ_FAILED", membershipResponse.error.message || "Lecture des workspaces impossible.");
        this.currentWorkspace = null;
        this.currentSite = null;
        this.currentRole = "";
        this.availableWorkspaces = [];
        return this.getStateSnapshot();
      }

      const memberships = Array.isArray(membershipResponse.data) ? membershipResponse.data : [];
      const workspaceIds = memberships.map(item => item.workspace_id).filter(Boolean);
      if (!workspaceIds.length) {
        this.currentWorkspace = null;
        this.currentSite = null;
        this.currentRole = "";
        this.availableWorkspaces = [];
        return this.getStateSnapshot();
      }

      const [workspaceResponse, siteResponse] = await Promise.all([
        this.client.from("workspaces").select("id, name, created_by, created_at").in("id", workspaceIds).order("created_at", { ascending: true }),
        this.client.from("sites").select("id, workspace_id, name, code, created_at").in("workspace_id", workspaceIds).order("created_at", { ascending: true })
      ]);
      if (workspaceResponse.error) {
        this.lastError = createRemoteError("WORKSPACE_READ_FAILED", workspaceResponse.error.message || "Lecture des workspaces impossible.");
      }
      if (siteResponse.error) {
        this.lastError = createRemoteError("SITE_READ_FAILED", siteResponse.error.message || "Lecture des sites impossible.");
      }

      const firstMembership = memberships[0] || null;
      const workspaces = Array.isArray(workspaceResponse.data) ? workspaceResponse.data : [];
      const sites = Array.isArray(siteResponse.data) ? siteResponse.data : [];
      this.availableWorkspaces = memberships.map(item => {
        const matchedWorkspace = workspaces.find(entry => entry.id === item.workspace_id) || null;
        const matchedSite = sites.find(entry => entry.workspace_id === item.workspace_id) || null;
        return {
          workspaceId: String(item.workspace_id || ""),
          workspaceName: matchedWorkspace?.name || "Workspace de test",
          siteId: matchedSite?.id || "",
          siteName: matchedSite?.name || "Site de test",
          siteCode: matchedSite?.code || "",
          role: String(item.role || ""),
          createdAt: String(item.created_at || "")
        };
      }).filter(item => item.workspaceId);

      const preferredWorkspaceId = this.getWorkspacePreference();
      const selectedEntry = this.availableWorkspaces.length === 1
        ? this.availableWorkspaces[0]
        : this.availableWorkspaces.find(item => item.workspaceId === preferredWorkspaceId) || null;

      if (!selectedEntry && this.availableWorkspaces.length > 1) {
        this.currentWorkspace = null;
        this.currentSite = null;
        this.currentRole = "";
        return this.getStateSnapshot();
      }

      const fallbackEntry = selectedEntry || (firstMembership ? this.availableWorkspaces.find(item => item.workspaceId === firstMembership.workspace_id) : null) || null;
      this.currentWorkspace = fallbackEntry ? { id: fallbackEntry.workspaceId, name: fallbackEntry.workspaceName } : null;
      this.currentSite = fallbackEntry ? { id: fallbackEntry.siteId, name: fallbackEntry.siteName, code: fallbackEntry.siteCode } : null;
      this.currentRole = fallbackEntry ? String(fallbackEntry.role || "") : "";
      if (fallbackEntry) this.setWorkspacePreference(fallbackEntry.workspaceId);
      return this.getStateSnapshot();
    }

    async selectWorkspace(workspaceId) {
      const targetId = String(workspaceId || "").trim();
      if (!targetId) throw createRemoteError("WORKSPACE_SELECTION_REQUIRED", "Sélectionnez un workspace avant de continuer.");
      if (!this.availableWorkspaces.length) {
        await this.refreshContext();
      }
      const target = this.availableWorkspaces.find(item => item.workspaceId === targetId);
      if (!target) throw createRemoteError("WORKSPACE_ACCESS_DENIED", "Ce workspace n'est pas accessible avec la session courante.");
      this.currentWorkspace = { id: target.workspaceId, name: target.workspaceName };
      this.currentSite = { id: target.siteId, name: target.siteName, code: target.siteCode };
      this.currentRole = String(target.role || "");
      this.setWorkspacePreference(target.workspaceId);
      return this.getStateSnapshot();
    }

    async initializeWorkspace(options = {}) {
      if (!this.client) throw createRemoteError("REMOTE_NOT_READY", "Client Supabase indisponible.");
      if (!this.isAuthenticated()) throw createRemoteError("AUTH_REQUIRED", "Authentification requise pour initialiser un workspace.");
      const displayName = String(options.displayName || "").trim();
      const workspaceName = String(options.workspaceName || "").trim();
      const siteName = String(options.siteName || "").trim();
      const siteCode = String(options.siteCode || "").trim();
      if (!displayName || !workspaceName || !siteName || !siteCode) {
        throw createRemoteError("WORKSPACE_INIT_INVALID", "Les informations du workspace de test sont incomplètes.");
      }

      const response = await this.client.rpc("deos_initialize_workspace", {
        p_display_name: displayName,
        p_workspace_name: workspaceName,
        p_site_name: siteName,
        p_site_code: siteCode
      });
      if (response.error) {
        throw createRemoteError("WORKSPACE_INIT_FAILED", response.error.message || "Initialisation du workspace impossible.", response.error);
      }

      const result = Array.isArray(response.data) ? (response.data[0] || {}) : (response.data || {});
      await this.refreshContext();
      const snapshot = this.getStateSnapshot();
      return {
        user_id: result.user_id || (this.user && this.user.id) || "",
        workspace_id: result.workspace_id || (snapshot.workspace && snapshot.workspace.id) || "",
        site_id: result.site_id || (snapshot.site && snapshot.site.id) || "",
        member_role: result.member_role || snapshot.role || "",
        created_workspace: Boolean(result.created_workspace),
        workspace: snapshot.workspace,
        site: snapshot.site,
        role: snapshot.role
      };
    }

    async signInWithPassword(email, password) {
      if (!this.client) throw createRemoteError("AUTH_NOT_READY", "Client Supabase indisponible.");
      const response = await this.client.auth.signInWithPassword({ email, password });
      if (response.error) throw createRemoteError("AUTH_SIGN_IN_FAILED", response.error.message || "Connexion impossible.");
      await this.applySession(response.data ? response.data.session : null, "SIGNED_IN");
      this.emit("SIGNED_IN");
      return this.getStateSnapshot();
    }

    async signInWithMagicLink(email) {
      if (!this.client) throw createRemoteError("AUTH_NOT_READY", "Client Supabase indisponible.");
      const redirectTo = this.getRedirectUrl();
      if (!redirectTo) throw createRemoteError("AUTH_REDIRECT_URL_REQUIRED", "URL de redirection manquante pour le lien magique.");
      const response = await this.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: false
        }
      });
      if (response.error) throw createRemoteError("AUTH_MAGIC_LINK_FAILED", response.error.message || "Envoi du lien magique impossible.");
      return { message: "Lien de connexion envoye." };
    }

    async resetPassword(email) {
      if (!this.client) throw createRemoteError("AUTH_NOT_READY", "Client Supabase indisponible.");
      const redirectTo = this.getRedirectUrl();
      if (!redirectTo) throw createRemoteError("AUTH_REDIRECT_URL_REQUIRED", "URL de redirection manquante pour la recuperation du mot de passe.");
      const response = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
      if (response.error) throw createRemoteError("AUTH_RESET_PASSWORD_FAILED", response.error.message || "Recuperation du mot de passe impossible.");
      return { message: "Email de recuperation envoye." };
    }

    async signOut() {
      if (!this.client) return this.getStateSnapshot();
      const response = await this.client.auth.signOut();
      if (response.error) throw createRemoteError("AUTH_SIGN_OUT_FAILED", response.error.message || "Deconnexion impossible.");
      await this.applySession(null, "SIGNED_OUT");
      this.emit("SIGNED_OUT");
      return this.getStateSnapshot();
    }

    async testConnection() {
      const readiness = shouldAllowRemoteInitialization(this.config);
      if (!readiness.ok) throw createRemoteError(readiness.code, readiness.message);
      const authUrl = new URL("auth/v1/settings", ensureTrailingSlash(this.config.supabaseUrl)).toString();
      const response = await fetch(authUrl, {
        method: "GET",
        headers: {
          apikey: this.config.supabasePublishableKey
        }
      });
      if (!response.ok) {
        throw createRemoteError("REMOTE_CONNECTION_TEST_FAILED", `Test de connexion HTTP ${response.status}.`);
      }
      return { ok: true };
    }

    onAuthStateChange(callback) {
      if (typeof callback !== "function") return { unsubscribe() {} };
      this.listeners.add(callback);
      return {
        unsubscribe: () => this.listeners.delete(callback)
      };
    }

    emit(eventName) {
      const snapshot = this.getStateSnapshot();
      for (const listener of this.listeners) {
        try {
          listener(eventName, this.session, snapshot);
        } catch (error) {
          safeConsole(this.debug, "error", "Listener auth en erreur.", error && error.message ? error.message : error);
        }
      }
    }
  }

  global.DeosSupabase = {
    DEFAULT_REMOTE_CONFIG,
    SUPABASE_JS_CDN_URL,
    normalizeRemoteConfig,
    mergeRemoteConfig,
    truncatePublicValue,
    maskEmailAddress,
    createRemoteError,
    loadSupabaseBrowserClient,
    DeosAuthService
  };
})(window);
