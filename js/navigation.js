'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.navigation = {
    switchView(viewName) {
        SGE_ETL.state.activeView = viewName;

        // Limpar active
        document.querySelectorAll('#nav [data-view], #nav .nav-module').forEach(el => {
            el.classList.remove('active');
        });

        const activeBtn = document.querySelector(`#nav [data-view="${viewName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            const parentModule = activeBtn.closest('.nav-module');
            if (parentModule) parentModule.classList.add('active');
        }

        // Trocar views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${viewName}-view`);
        if (target) target.classList.add('active');

        // Render data when navigating
        switch (viewName) {
            case 'aplicacao':
                SGE_ETL.aplicacao.render();
                break;
            case 'pesquisa':
                // Focus naturally
                document.getElementById('search-input')?.focus();
                break;
            case 'relatorio':
                SGE_ETL.relatorio.render();
                break;
            case 'dashboard':
                SGE_ETL.dashboard.render();
                break;
            case 'settings':
                SGE_ETL.settings.render();
                break;
        }
    }
};
