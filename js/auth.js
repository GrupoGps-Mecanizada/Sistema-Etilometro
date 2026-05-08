'use strict';

/**
 * SGE_ETL — Authentication Module
 * Mirrors Gestão Efetivo: SSO first, then Supabase local session fallback.
 * Uses window.supabase (not window.supabaseClient).
 */
window.SGE_ETL = window.SGE_ETL || {};

const ssoClient = window.SgeAuthSDK ? new window.SgeAuthSDK('etilometro_mec') : null;

SGE_ETL.auth = {
    currentUser: null,

    async init() {
        // 1. Try SSO authentication
        if (ssoClient) {
            const userData = await ssoClient.checkAuth();

            if (userData) {
                console.log('[SGE_ETL AUTH] Autenticado via SSO:', userData.nome);
                this.updateCurrentUser(userData);
                let token = null;
                try {
                    const { data: { session } } = await window.supabase.auth.getSession();
                    token = session?.access_token || null;
                } catch (e) {}
                await this.registerSession(userData.id, token);
                return true;
            }

            if (ssoClient.isBypass()) {
                // 2. Bypass active — try existing Supabase session
                console.log('[SGE_ETL AUTH] BYPASS ativo — verificando sessão Supabase local...');
                try {
                    if (window.supabase) {
                        const { data: { session } } = await window.supabase.auth.getSession();
                        if (session && session.user) {
                            console.log('[SGE_ETL AUTH] Sessão local encontrada:', session.user.email);
                            this.updateCurrentUser({
                                id: session.user.id,
                                email: session.user.email,
                                nome: session.user.user_metadata?.nome || session.user.email.split('@')[0],
                                perfil: session.user.user_metadata?.perfil || 'GESTAO'
                            });
                            await this.registerSession(session.user.id, session.access_token);
                            return true;
                        }
                    }
                } catch (e) {
                    console.warn('[SGE_ETL AUTH] Erro ao verificar sessão:', e);
                }

                // No session — show login screen
                console.log('[SGE_ETL AUTH] Sem sessão — exibindo login local');
                return false;
            }

            // SSO active but no token — SSO client will redirect
            return false;
        }

        // 3. No SSO client — fallback to pure local Supabase auth
        console.warn('[SGE_ETL AUTH] SSO Client não encontrado. Usando fallback Supabase local.');
        try {
            if (window.supabase) {
                const { data: { session } } = await window.supabase.auth.getSession();
                if (session && session.user) {
                    this.updateCurrentUser({
                        id: session.user.id,
                        email: session.user.email,
                        nome: session.user.user_metadata?.nome || session.user.email.split('@')[0],
                        perfil: session.user.user_metadata?.perfil || 'GESTAO'
                    });
                    return true;
                }
            }
        } catch (e) {}
        return false;
    },

    async registerSession(userId, accessToken) {
        try {
            const existingId = localStorage.getItem('sge_session_id');
            if (existingId) return;

            if (!accessToken && window.supabase) {
                const { data: { session } } = await window.supabase.auth.getSession();
                accessToken = session?.access_token || null;
            }
            if (!accessToken) {
                console.warn('[SGE_ETL AUTH] Sem token — sessão não será registrada (RLS bloqueia anon)');
                return;
            }

            const SUPABASE_URL = SGE_ETL.SUPABASE_URL;
            const ANON_KEY = SGE_ETL.SUPABASE_KEY;

            const sysResp = await fetch(
                `${SUPABASE_URL}/rest/v1/sge_central_sistemas?slug=eq.etilometro_mec&select=id`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept-Profile': 'gps_compartilhado',
                        'Accept': 'application/vnd.pgrst.object+json'
                    }
                }
            );

            if (!sysResp.ok) return;
            const sysData = await sysResp.json();
            if (!sysData || !sysData.id) return;

            const sessResp = await fetch(`${SUPABASE_URL}/rest/v1/sge_central_sessoes`, {
                method: 'POST',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Profile': 'gps_compartilhado',
                    'Accept-Profile': 'gps_compartilhado',
                    'Prefer': 'return=representation'
                },
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
                    localStorage.setItem('sge_session_user_name', this.currentUser?.nome || 'Usuário');
                    localStorage.setItem('sge_session_user_email', this.currentUser?.email || '');
                    localStorage.setItem('sge_session_app_slug', 'etilometro_mec');
                    localStorage.setItem('sge_session_app_name', 'Etilometria Digital');
                    if (window.SGE_SESSION_PING) window.SGE_SESSION_PING.start();
                }
            }
        } catch (err) {
            console.warn('[SGE_ETL AUTH] registerSession falhou:', err);
        }
    },

    updateCurrentUser(user) {
        this.currentUser = {
            id: user.id || null,
            usuario: user.email ? user.email.split('@')[0] : 'Desconhecido',
            email: user.email || '',
            nome: user.nome || 'Usuário SGE',
            perfil: user.perfil || 'VISAO'
        };

        SGE_ETL.state.user = this.currentUser;

        const topbarUser = document.getElementById('topbar-user');
        if (topbarUser) {
            topbarUser.innerHTML = `
                <div style="text-align: right; margin-right: 4px;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--slate-700);">${this.currentUser.nome.split(' ')[0]}</div>
                    <div style="font-size: 11px; color: var(--slate-500);">${this.currentUser.email}</div>
                </div>
                <button onclick="SGE_ETL.auth.logout()" title="Sair do sistema"
                    style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; display:flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#ef4444; cursor:pointer; margin-right:8px; white-space:nowrap;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sair
                </button>
            `;
        }

        const navMenuUser = document.getElementById('nav-menu-user');
        if (navMenuUser) {
            navMenuUser.innerHTML = `
                <div style="padding:12px 16px; border-top:1px solid #e2e8f0;">
                    <div style="font-size:12px; font-weight:600; color:#0f172a; margin-bottom:2px;">${this.currentUser.nome}</div>
                    <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">${this.currentUser.email}</div>
                    <button onclick="SGE_ETL.auth.logout()"
                        style="width:100%; padding:10px; background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; color:#dc2626; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sair / Deslogar
                    </button>
                </div>
            `;
        }
    },

    async login(email, password) {
        if (!window.supabase) throw new Error('Supabase client não inicializado');
        const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        this.updateCurrentUser({
            id: data.user.id,
            email: data.user.email,
            nome: data.user.user_metadata?.nome || data.user.email.split('@')[0],
            perfil: data.user.user_metadata?.perfil || 'GESTAO'
        });

        await this.registerSession(data.user.id, data.session?.access_token);
        return { success: true, data };
    },

    async logout() {
        if (window.SGE_SESSION_PING) window.SGE_SESSION_PING.stop();
        ['sge_session_id', 'sge_session_user_id', 'sge_session_token', 'sge_session_user_name',
         'sge_session_user_email', 'sge_session_app_slug', 'sge_session_app_name'].forEach(k => localStorage.removeItem(k));

        if (ssoClient && ssoClient.isBypass()) {
            if (window.supabase) await window.supabase.auth.signOut();
            window.location.reload();
            return;
        }

        if (ssoClient) ssoClient.logout();
        else {
            if (window.supabase) await window.supabase.auth.signOut();
            window.location.reload();
        }
    }
};
