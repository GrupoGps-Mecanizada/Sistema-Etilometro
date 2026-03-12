'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.navigation = {
    init() {
        // Hamburger menu toggle
        const menuBtn = document.getElementById('nav-menu-btn');
        const overlay = document.getElementById('nav-menu-overlay');
        const logoHome = document.getElementById('logo-home');

        if (menuBtn && overlay) {
            menuBtn.addEventListener('click', () => overlay.classList.toggle('hidden'));

            // Close when clicking backdrop
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.add('hidden');
            });

            // Close on ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') overlay.classList.add('hidden');
            });
        }

        // Sidebar nav items
        document.querySelectorAll('.nav-menu-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
                if (overlay) overlay.classList.add('hidden');
            });
        });

        // Logo click → dashboard
        if (logoHome) {
            logoHome.addEventListener('click', () => {
                this.switchView('aplicacao');
                if (overlay) overlay.classList.add('hidden');
            });
        }

        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', async () => {
            await SGE_ETL.api.loadDiario();
            const view = SGE_ETL.state.activeView;
            if (view) this.switchView(view);
        });
    },

    switchView(viewName) {
        SGE_ETL.state.activeView = viewName;

        // Update sidebar active state
        document.querySelectorAll('.nav-menu-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Swap views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${viewName}-view`);
        if (target) target.classList.add('active');

        // Trigger view-specific rendering
        switch (viewName) {
            case 'aplicacao':
                if (SGE_ETL.aplicacao?.render) SGE_ETL.aplicacao.render();
                break;
            case 'pesquisa':
                document.getElementById('search-input')?.focus();
                break;
            case 'relatorio':
                if (SGE_ETL.relatorio?.render) SGE_ETL.relatorio.render();
                break;
            case 'dashboard':
                if (SGE_ETL.dashboard?.render) SGE_ETL.dashboard.render();
                break;
            case 'pendentes':
                if (SGE_ETL.pendentes?.load) SGE_ETL.pendentes.load();
                break;
        }
    }
};
