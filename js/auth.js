'use strict';

/**
 * SGE_ETL — Login (via SGE.acesso do sge-core)
 * Usa a sessão real do login da Central (Supabase Auth). Sem sessão, vai para o login da Central.
 * Na dúvida (erro, rede), não entra.
 */
window.SGE_ETL = window.SGE_ETL || {};

const SLUG_SISTEMA = 'etilometro_mec';

// Régua única → nomes antigos (ver "Régua única de acesso - especificação" no cofre).
const PERFIL_POR_PAPEL = { ADMIN: 'ADM', GESTOR: 'GESTAO' };

SGE_ETL.auth = {
    currentUser: null,

    async init() {
        const core = window.SGECore;
        if (!core || !core.acesso) {
            // Sem o sge-core (falha ao baixar) não dá para conferir o login: não entra.
            const status = document.getElementById('loading-status');
            if (status) status.textContent = 'Não consegui carregar o login. Confira a internet e recarregue a página.';
            await new Promise(() => {});
        }

        // Só continua se a pessoa estiver logada e tiver acesso a este sistema.
        const r = await core.acesso.entrar(SLUG_SISTEMA);
        this.updateCurrentUser({
            id: r.usuario.id,
            email: r.usuario.email,
            nome: r.usuario.nome,
            perfil: PERFIL_POR_PAPEL[r.papel] || 'VISAO'
        });
        return true;
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

    // O login agora é só pela Central.
    async login() { throw new Error('Entre pela Central do SGE.'); },

    async logout() {
        window.SGECore.acesso.sair(SLUG_SISTEMA);
    }
};
