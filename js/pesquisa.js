'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.pesquisa = {
    searchTimeout: null,

    init() {
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        this.els = {
            input: document.getElementById('search-input'),
            loading: document.getElementById('search-loading'),
            results: document.getElementById('search-results')
        };
    },

    bindEvents() {
        if (!this.els.input) return;

        this.els.input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            clearTimeout(this.searchTimeout);

            if (val.length < 3) {
                if (val.length === 0) {
                    this.els.results.innerHTML = `<div class="text-center text-slate-400 py-8 text-sm border border-slate-200 border-dashed rounded-lg bg-slate-50" style="grid-column: 1 / -1;">Utilize a barra de pesquisa acima para procurar testes específicos.</div>`;
                }
                return;
            }

            this.searchTimeout = setTimeout(() => {
                this.performSearch(val);
            }, 500);
        });
    },

    async performSearch(query) {
        this.els.results.innerHTML = '';
        this.els.loading.style.display = 'block';

        const res = await SGE_ETL.api.searchEtilometria(query);

        this.els.loading.style.display = 'none';

        if (!res.success) {
            this.els.results.innerHTML = `<div class="text-center text-danger-text py-4" style="grid-column: 1 / -1;">Erro: ${res.error}</div>`;
            return;
        }

        if (res.data.length === 0) {
            this.els.results.innerHTML = `<div class="text-center text-slate-400 py-8 text-sm border border-slate-200 border-dashed rounded-lg bg-slate-50" style="grid-column: 1 / -1;">Nenhum teste encontrado para "${query}".</div>`;
            return;
        }

        // Generate elements as real DOM nodes to attach properly (avoiding giant JSON stringification on onclicks)
        res.data.forEach(t => {
            const color = SGE_ETL.helpers.statusColor(t.status);
            const initial = t.status.charAt(0);
            const dtFormated = SGE_ETL.helpers.formatDate(t.data_hora);

            const card = document.createElement('div');
            card.className = 'search-card';
            card.style.cssText = `background:#fff; border: 1px solid var(--border); border-left: 4px solid ${color}; border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s ease;`;

            card.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 700; color: var(--slate-800); font-size: 1rem; margin-bottom: 2px;">${t.colaborador || 'Sem Nome'}</div>
                        <div style="font-size: 0.75rem; color: var(--slate-500); opacity: 0.8;">Data: ${dtFormated}</div>
                    </div>
                    <div style="background: ${color}20; color: ${color}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">${initial}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem; color: var(--slate-600); margin-bottom: 12px; background: var(--slate-50); padding: 8px; border-radius: 6px;">
                    <div>
                        <span style="display:block; font-size: 0.65rem; color: var(--slate-400); text-transform: uppercase; font-weight: 600;">Função/Matrícula</span>
                        ${t.funcao || '-'}
                    </div>
                    <div>
                        <span style="display:block; font-size: 0.65rem; color: var(--slate-400); text-transform: uppercase; font-weight: 600;">Resultado</span>
                        <span style="font-weight: bold; color: ${color}; font-size:1.1rem">${t.resultado}</span> mg/L
                    </div>
                </div>
                <div style="font-size: 0.7rem; color: var(--slate-400); border-top: 1px solid var(--slate-100); padding-top: 8px; text-align: right;">
                    Testado por: ${t.operador}
                </div>
            `;

            card.addEventListener('click', () => {
                SGE_ETL.drawer.open(t);
            });

            this.els.results.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }
};
