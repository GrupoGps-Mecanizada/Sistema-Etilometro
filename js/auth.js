'use strict';

/**
 * SGE_ETL — Authentication Module (Via Central SGE SSO com fallback local)
 * Handles token recovery, session management, and role-based permissions
 *
 * BYPASS ativo para rollout gradual — login local (mock) continua funcionando.
 * Quando a Central SSO estiver 100%, basta comentar a linha SGE_SSO_BYPASS = true.
 */
window.SGE_ETL = window.SGE_ETL || {};

// ========== SSO MODE ==========
// BYPASS ativo para rollout gradual — login local continua funcionando
window.SGE_SSO_BYPASS = true;

// Instancia o SDK passando o slug do sistema
const ssoClient = new window.SgeAuthSDK('etilometro_mec');

SGE_ETL.auth = {
    /**
     * Initialize Auth — tenta SSO, senao fallback para login local (mock)
     */
    init() {
        return this._initAsync();
    },

    async _initAsync() {
        // 1. Tenta autenticacao via SSO Token
        try {
            const userData = await ssoClient.checkAuth();

            if (userData) {
                console.log('[ETL AUTH] Autenticado via SSO:', userData.nome);
                SGE_ETL.state.user = {
                    id: userData.id,
                    nome: userData.nome || 'Usuario',
                    email: userData.email || '',
                    perfil: userData.perfil || 'OP'
                };
                this.updateTopbar();
                await this.registerSession(userData.id);
                return true;
            }
        } catch (e) {
            console.warn('[ETL AUTH] Erro no SSO checkAuth:', e);
        }

        if (ssoClient.isBypass()) {
            // BYPASS: tenta login local (mock — original behavior)
            console.log('[ETL AUTH] BYPASS ativo — verificando login local...');
            const user = localStorage.getItem('SGE_ETL_USER');
            if (user) {
                SGE_ETL.state.user = { nome: user, perfil: 'OP' };
                this.updateTopbar();
                return true;
            }
            return false;
        }

        // SSO ativo mas sem token — ssoClient ja redirecionou
        return false;
    },

    /**
     * Register session in sge_central_sessoes for the Radar
     */
    async registerSession(userId) {
        try {
            const existingId = localStorage.getItem('sge_session_id');
            if (existingId) {
                console.log('[ETL AUTH] Sessao ja registrada:', existingId);
                return;
            }

            // Try to get an access token from Supabase (if available)
            let accessToken = null;
            try {
                if (window.supabase) {
                    const { data: { session } } = await window.supabase.auth.getSession();
                    accessToken = session?.access_token || null;
                }
            } catch (e) { /* ignore — Etilometro may not have Supabase */ }

            if (!accessToken) {
                console.warn('[ETL AUTH] Sem token autenticado — sessao nao sera registrada (RLS bloqueia anon)');
                return;
            }

            const SUPABASE_URL = window.SGE_ETL?.CONFIG?.SUPABASE_URL || this._getSupabaseUrl();
            const ANON_KEY = window.SGE_ETL?.CONFIG?.SUPABASE_KEY || this._getAnonKey();
            if (!SUPABASE_URL || !ANON_KEY) return;

            const headers = {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Profile': 'gps_compartilhado',
                'Accept-Profile': 'gps_compartilhado',
                'Prefer': 'return=representation'
            };

            // Get sistema_id for this app slug
            const sysResp = await fetch(
                `${SUPABASE_URL}/rest/v1/sge_central_sistemas?slug=eq.etilometro_mec&select=id`,
                { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${accessToken}`, 'Accept-Profile': 'gps_compartilhado', 'Accept': 'application/vnd.pgrst.object+json' } }
            );

            if (!sysResp.ok) {
                console.warn('[ETL AUTH] Nao conseguiu buscar sistema para sessao');
                return;
            }

            const sysData = await sysResp.json();
            if (!sysData?.id) return;

            // Insert session
            const sessResp = await fetch(`${SUPABASE_URL}/rest/v1/sge_central_sessoes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    usuario_id: userId,
                    sistema_id: sysData.id,
                    ip_address: '0.0.0.0',
                    user_agent: navigator.userAgent.substring(0, 200),
                    expira_em: new Date(Date.now() + (1000 * 60 * 60 * 8)).toISOString()
                })
            });

            if (sessResp.ok) {
                const sessData = await sessResp.json();
                const sessionId = Array.isArray(sessData) ? sessData[0]?.id : sessData?.id;
                if (sessionId) {
                    localStorage.setItem('sge_session_id', sessionId);
                    localStorage.setItem('sge_session_user_id', userId);
                    localStorage.setItem('sge_session_token', accessToken);
                    localStorage.setItem('sge_session_user_name', SGE_ETL.state.user?.nome || 'Usuario');
                    localStorage.setItem('sge_session_user_email', SGE_ETL.state.user?.email || '');
                    localStorage.setItem('sge_session_app_slug', 'etilometro_mec');
                    localStorage.setItem('sge_session_app_name', 'Etilometria Digital');
                    console.log('[ETL AUTH] Sessao registrada para Radar:', sessionId);
                    if (window.SGE_SESSION_PING) window.SGE_SESSION_PING.start();
                }
            } else {
                const errText = await sessResp.text().catch(() => '');
                console.warn('[ETL AUTH] Falha ao registrar sessao:', sessResp.status, errText);
            }
        } catch (err) {
            console.warn('[ETL AUTH] Erro ao registrar sessao:', err);
        }
    },

    /**
     * Helper: resolve Supabase URL from config or supabase client
     */
    _getSupabaseUrl() {
        try {
            if (window.supabase?.supabaseUrl) return window.supabase.supabaseUrl;
            if (window.SGE_ETL?.CONFIG?.SUPABASE_URL) return window.SGE_ETL.CONFIG.SUPABASE_URL;
        } catch (e) { }
        return null;
    },

    _getAnonKey() {
        try {
            if (window.supabase?.supabaseKey) return window.supabase.supabaseKey;
            if (window.SGE_ETL?.CONFIG?.SUPABASE_KEY) return window.SGE_ETL.CONFIG.SUPABASE_KEY;
        } catch (e) { }
        return null;
    },

    /**
     * Login local (mock — preserved original behavior for BYPASS mode)
     */
    async login(username, password) {
        if (!username) return { success: false, error: 'Digite seu nome de usuario' };

        localStorage.setItem('SGE_ETL_USER', username);
        SGE_ETL.state.user = { nome: username, perfil: 'OP' };
        this.updateTopbar();
        return { success: true };
    },

    /**
     * Logout
     */
    logout() {
        console.log('[ETL AUTH] Logout');

        // Clean up session data
        try {
            localStorage.removeItem('sge_session_id');
            localStorage.removeItem('sge_session_user_id');
            localStorage.removeItem('sge_session_token');
            localStorage.removeItem('sge_session_user_name');
            localStorage.removeItem('sge_session_user_email');
            localStorage.removeItem('sge_session_app_slug');
            localStorage.removeItem('sge_session_app_name');
        } catch (e) { }

        // Stop ping
        if (window.SGE_SESSION_PING) window.SGE_SESSION_PING.stop();

        if (ssoClient.isBypass()) {
            localStorage.removeItem('SGE_ETL_USER');
            location.reload();
            return;
        }

        ssoClient.logout();
    },

    /**
     * Update topbar UI with user info (preserved original layout)
     */
    updateTopbar() {
        const el = document.getElementById('topbar-user');
        if (el && SGE_ETL.state.user) {
            el.innerHTML = `
                <div style="text-align:right">
                    <div style="font-size:12px; font-weight:600; color:var(--text-1)">${SGE_ETL.state.user.nome}</div>
                    <div style="font-size:10px; color:var(--text-3); display:flex; gap:4px; justify-content:flex-end">
                        <button id="btn-logout" style="background:none; border:none; color:var(--danger-text); cursor:pointer; font-size:10px; padding:0">Sair</button>
                    </div>
                </div>
                <div style="width:32px; height:32px; border-radius:50%; background:var(--bg-card); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; margin-left:8px; font-weight:600; color:var(--primary)">
                    ${SGE_ETL.state.user.nome.charAt(0).toUpperCase()}
                </div>
            `;
            document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
        }
    }
};
