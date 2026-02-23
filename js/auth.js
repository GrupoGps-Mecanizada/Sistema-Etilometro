'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.auth = {
    init() {
        // Mock auth since there's no backend user table for Etilometria
        const user = localStorage.getItem('SGE_ETL_USER');
        if (user) {
            SGE_ETL.state.user = { nome: user, perfil: 'OP' };
            this.updateTopbar();
            return true;
        }
        return false;
    },

    async login(username, password) {
        // Fake login: accepts any username. 
        // We just need who is operating the system for local audit
        if (!username) return { success: false, error: 'Digite seu nome de usuário' };

        localStorage.setItem('SGE_ETL_USER', username);
        SGE_ETL.state.user = { nome: username, perfil: 'OP' };
        this.updateTopbar();
        return { success: true };
    },

    logout() {
        localStorage.removeItem('SGE_ETL_USER');
        location.reload();
    },

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
