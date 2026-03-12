'use strict';

/**
 * SGE_ETL — Pendentes Module
 * Compares all active collaborators against today's etilometry tests
 * and shows those who have not yet been tested.
 */
window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.pendentes = {
    allColaboradores: [],
    testedIds: new Set(),

    async load() {
        const loadingEl = document.getElementById('pendentes-loading');
        const listEl = document.getElementById('pendentes-list');
        const totalEl = document.getElementById('pend-total');
        const testadosEl = document.getElementById('pend-testados');
        const pendentesEl = document.getElementById('pend-pendentes');
        const menuStat = document.getElementById('stat-testes-menu');

        if (!window.supabase) {
            if (listEl) listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:#ef4444;">Supabase não inicializado.</div>';
            return;
        }

        if (loadingEl) loadingEl.style.display = 'flex';
        if (listEl) listEl.innerHTML = '';

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch in parallel: all active colaboradores + today's tests
            const [colabRes, testRes] = await Promise.all([
                window.supabase
                    .schema('gps_mec')
                    .from('efetivo_gps_mec_colaboradores')
                    .select('id, name, function, status')
                    .neq('status', 'DESLIGADO')
                    .order('name'),
                window.supabase
                    .schema('gps_mec')
                    .from('efetivo_gps_mec_etilometria')
                    .select('colaborador_id, colaborador_nome')
                    .gte('data_hora', today.toISOString())
            ]);

            if (colabRes.error) throw colabRes.error;
            if (testRes.error) throw testRes.error;

            const colaboradores = colabRes.data || [];
            const tests = testRes.data || [];

            // Build a set of tested colaborador IDs (and names for those without ID)
            this.testedIds = new Set();
            const testedNames = new Set();
            tests.forEach(t => {
                if (t.colaborador_id) this.testedIds.add(t.colaborador_id);
                if (t.colaborador_nome) testedNames.add(t.colaborador_nome.trim().toUpperCase());
            });

            // Filter pendentes: no test today
            const pendentes = colaboradores.filter(c => {
                if (this.testedIds.has(c.id)) return false;
                if (testedNames.has((c.name || '').trim().toUpperCase())) return false;
                return true;
            });

            this.allColaboradores = pendentes;

            // Update stats
            const total = colaboradores.length;
            const testados = total - pendentes.length;
            if (totalEl) totalEl.textContent = total;
            if (testadosEl) testadosEl.textContent = testados;
            if (pendentesEl) pendentesEl.textContent = pendentes.length;
            if (menuStat) menuStat.textContent = testados;

            this.render(pendentes);
        } catch (err) {
            console.error('Pendentes load error:', err);
            if (listEl) listEl.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;">Erro ao carregar: ${err.message}</div>`;
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    },

    render(pendentes) {
        const listEl = document.getElementById('pendentes-list');
        if (!listEl) return;

        if (!pendentes || pendentes.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#16a34a;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:40px;height:40px;margin:0 auto 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <div style="font-size:1.1rem; font-weight:700;">Todos os colaboradores já foram testados hoje!</div>
                </div>`;
            return;
        }

        const rows = pendentes.map(c => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight:600; font-size:14px; color:var(--text-1);">${c.name || '—'}</div>
                    <div style="font-size:12px; color:var(--text-3); margin-top:2px;">${c.function || '—'} · ${c.status || '—'}</div>
                </div>
                <span style="background:#fff5f5; color:#ef4444; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; border:1px solid #fca5a5; white-space:nowrap;">PENDENTE</span>
            </div>
        `).join('');

        listEl.innerHTML = rows;
    },

    filter(term) {
        if (!term) {
            this.render(this.allColaboradores);
            return;
        }
        const t = term.toLowerCase();
        const filtered = this.allColaboradores.filter(c =>
            (c.name || '').toLowerCase().includes(t) ||
            (c.function || '').toLowerCase().includes(t)
        );
        this.render(filtered);
    },

    init() {
        const refreshBtn = document.getElementById('btn-refresh-pendentes');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.load());
        }

        const searchInput = document.getElementById('pend-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filter(e.target.value));
        }
    }
};
