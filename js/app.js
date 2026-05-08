'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.app = {
    async init() {
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');

        if (await SGE_ETL.auth.init()) {
            if (loginScreen) loginScreen.classList.add('hidden');
            SGE_ETL.app.boot();
        } else {
            if (loadingScreen) loadingScreen.classList.add('hide');
            if (loginScreen) loginScreen.classList.remove('hidden');
            SGE_ETL.app.setupLoginForm();
        }
    },

    setupLoginForm() {
        const form = document.getElementById('login-form');
        const errEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Autenticando...';

            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;

            const res = await SGE_ETL.auth.login(user, pass);

            if (res.success) {
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('loading-screen').classList.remove('hide');
                SGE_ETL.app.boot();
            } else {
                errEl.textContent = res.error;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
    },

    async boot() {
        const loadingScreen = document.getElementById('loading-screen');
        const statusEl = document.getElementById('loading-status');
        const topbar = document.getElementById('topbar');
        const main = document.getElementById('main');

        if (topbar) topbar.style.opacity = '0';
        if (main) main.style.opacity = '0';

        const setStatus = (msg) => {
            if (statusEl) statusEl.innerHTML = msg + '<span class="loading-dots"></span>';
        };

        setStatus('Conectando e baixando dados do dia...');
        await SGE_ETL.api.loadDiario();

        SGE_ETL.helpers.updateStats();

        // Initialize all modules
        SGE_ETL.navigation.init();
        SGE_ETL.dashboard?.init?.();
        SGE_ETL.app.setupDrawer();
        SGE_ETL.app.setupModal();
        SGE_ETL.aplicacao.init();
        SGE_ETL.pesquisa.init();
        SGE_ETL.relatorio.init();
        SGE_ETL.pendentes.init();

        SGE_ETL.navigation.switchView('aplicacao');

        await new Promise(r => setTimeout(r, 300));
        if (topbar) { topbar.style.transition = 'opacity .4s ease'; topbar.style.opacity = '1'; }
        if (main) { main.style.transition = 'opacity .4s ease'; main.style.opacity = '1'; }

        if (loadingScreen && loadingScreen.parentNode) {
            loadingScreen.classList.add('hide');
            setTimeout(() => loadingScreen.remove(), 700);
        }
    },

    setupDrawer() {
        document.getElementById('drawer-overlay')?.addEventListener('click', SGE_ETL.drawer.close);
        document.getElementById('drawer-close')?.addEventListener('click', SGE_ETL.drawer.close);
    },

    setupModal() {
        document.getElementById('modal-overlay')?.addEventListener('click', e => {
            if (e.target === document.getElementById('modal-overlay')) {
                SGE_ETL.modal.close();
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => SGE_ETL.app.init());
