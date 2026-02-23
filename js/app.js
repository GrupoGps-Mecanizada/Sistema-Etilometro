'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.app = {
    async init() {
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');

        if (SGE_ETL.auth.init()) {
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
        if (SGE_ETL.CONFIG.gasUrl) {
            await SGE_ETL.api.loadDiario();
        } else {
            setStatus('Modo Offline — Sem URL configurada');
            await new Promise(r => setTimeout(r, 600));
        }

        SGE_ETL.helpers.updateStats();

        SGE_ETL.app.setupNavigation();
        SGE_ETL.app.setupDrawer();
        SGE_ETL.app.setupModal();
        SGE_ETL.app.setupRefresh();

        // Boot specific logic modules
        SGE_ETL.aplicacao.init();
        SGE_ETL.pesquisa.init();
        SGE_ETL.relatorio.init();
        SGE_ETL.settings.init();

        SGE_ETL.navigation.switchView('aplicacao');

        await new Promise(r => setTimeout(r, 300));
        if (topbar) { topbar.style.transition = 'opacity .4s ease'; topbar.style.opacity = '1'; }
        if (main) { main.style.transition = 'opacity .4s ease'; main.style.opacity = '1'; }

        if (loadingScreen && loadingScreen.parentNode) {
            loadingScreen.classList.add('hide');
            setTimeout(() => loadingScreen.remove(), 700);
        }
    },

    setupNavigation() {
        document.querySelectorAll('#nav [data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                SGE_ETL.navigation.switchView(btn.dataset.view);
                const nav = document.getElementById('nav');
                if (nav && nav.classList.contains('mobile-open')) {
                    nav.classList.remove('mobile-open');
                }
            });
        });

        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                const nav = document.getElementById('nav');
                if (nav) nav.classList.toggle('mobile-open');
            });
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
    },

    setupRefresh() {
        const btn = document.getElementById('refresh-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                SGE_ETL.helpers.toast('Recarregando dados do dia...', 'info');
                await SGE_ETL.api.loadDiario();
                SGE_ETL.helpers.updateStats();
                SGE_ETL.navigation.switchView(SGE_ETL.state.activeView); // re-render
                SGE_ETL.helpers.toast('Dados atualizados', 'success');
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => SGE_ETL.app.init());
