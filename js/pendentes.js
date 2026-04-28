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
                    .select('id, name, function, status, regime, category')
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

            // Filter pendentes: no test today AND not on their day off
            const todayStr = new Date().toISOString().split('T')[0];
            
            // Render the off-duty shifts for today on the panel
            const baseShifts = ['A', 'B', 'C', 'D', 'ADM'];
            const shiftsOff = [];
            baseShifts.forEach(shift => {
                 const statusShift = window.SGE_ETL.helpers.calcularTurno(todayStr, shift);
                 if (statusShift === 'F') shiftsOff.push(shift);
            });
            const folgasEl = document.getElementById('pend-folgas');
            if (folgasEl) {
                if (shiftsOff.length === 0) folgasEl.textContent = 'Nenhuma';
                // Replace ADM with ADM directly, otherwise join letters
                else folgasEl.textContent = shiftsOff.join(', ');
            }

            // Keep only OPERACIONAL staff
            const operacionais = colaboradores.filter(c => c.category !== 'GESTAO');

            let countTestados = 0;
            let countFolgas = 0;
            let countPendentes = 0;

            // Compute correct status for all operational staff
            const diario = operacionais.map(c => {
                let statusDia = 'PENDENTE';
                let turnoHover = c.regime || 'Sem Turma';
                
                // 1. Check if on rest day
                if (c.regime) {
                    const statusShift = window.SGE_ETL.helpers.calcularTurno(todayStr, c.regime);
                    if (statusShift === 'F') {
                        statusDia = 'FOLGA';
                    }
                }

                // 2. Overwrite if actually tested (even if on their day off)
                const cNameObj = (c.name || '').trim().toUpperCase();
                if (this.testedIds.has(c.id) || testedNames.has(cNameObj)) {
                    statusDia = 'REALIZADO';
                }

                // Tally stats
                if (statusDia === 'REALIZADO') countTestados++;
                else if (statusDia === 'FOLGA') countFolgas++;
                else countPendentes++;

                return {
                    ...c,
                    statusDia: statusDia,
                    turnoNormalizado: turnoHover
                };
            });

            this.allColaboradores = diario;

            // Update stats
            const total = operacionais.length;
            if (totalEl) totalEl.textContent = total;
            if (testadosEl) testadosEl.textContent = countTestados;
            if (pendentesEl) pendentesEl.textContent = countPendentes;
            if (menuStat) menuStat.textContent = countTestados;

            // Trigger standard filter read to apply defaults
            this.applyFilters();
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

        const rows = pendentes.map(c => {
            let badgeHtml = '';
            let styleCard = '';
            
            if (c.statusDia === 'REALIZADO') {
                badgeHtml = `<span style="background:#dcfce7; color:#166534; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; border:1px solid #86efac; white-space:nowrap;">REALIZADO</span>`;
            } else if (c.statusDia === 'FOLGA') {
                badgeHtml = `<span style="background:#f3f4f6; color:#4b5563; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; border:1px solid #d1d5db; white-space:nowrap;">FOLGA</span>`;
                styleCard = `opacity:0.6;`;
            } else {
                badgeHtml = `<span style="background:#fff5f5; color:#ef4444; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; border:1px solid #fca5a5; white-space:nowrap;">PENDENTE</span>`;
            }

            return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); transition:background 0.15s; ${styleCard}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight:600; font-size:14px; color:var(--text-1);">${c.name || '—'}</div>
                    <div style="font-size:12px; color:var(--text-3); margin-top:2px;">${c.function || '—'} · Turma: ${c.turnoNormalizado}</div>
                </div>
                ${badgeHtml}
            </div>`;
        }).join('');

        listEl.innerHTML = rows;
    },

    applyFilters() {
        if (!this.allColaboradores) return;

        const term = (document.getElementById('pend-search')?.value || '').toLowerCase();
        const statusF = document.getElementById('pend-filter-status')?.value || 'todos';
        const turnoF = document.getElementById('pend-filter-turno')?.value || 'todos';

        const filtered = this.allColaboradores.filter(c => {
            // 1. Text Search
            if (term) {
                if (!(c.name || '').toLowerCase().includes(term) && 
                    !(c.function || '').toLowerCase().includes(term)) {
                    return false;
                }
            }
            
            // 2. Status Match
            if (statusF !== 'todos' && c.statusDia !== statusF) {
                return false;
            }

            // 3. Turno Match
            if (turnoF !== 'todos') {
                const trn = (c.turnoNormalizado || '').toUpperCase();
                if (!trn.includes(turnoF)) return false;
            }

            return true;
        });

        this.render(filtered);
    },

    init() {
        const refreshBtn = document.getElementById('btn-refresh-pendentes');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.load());
        }

        const btnCopiar = document.getElementById('btn-copiar-pendentes');
        if (btnCopiar) {
            btnCopiar.addEventListener('click', () => this.copiarFaltantes());
        }

        const searchInput = document.getElementById('pend-search');
        if (searchInput) searchInput.addEventListener('input', () => this.applyFilters());

        const selectStatus = document.getElementById('pend-filter-status');
        if (selectStatus) selectStatus.addEventListener('change', () => this.applyFilters());

        const selectTurno = document.getElementById('pend-filter-turno');
        if (selectTurno) selectTurno.addEventListener('change', () => this.applyFilters());
    },

    copiarFaltantes() {
        // Find visible missing employees directly from the underlying list representing current DOM state
        // We simulate the filter state to grab the exact matching list to copy
        const term = (document.getElementById('pend-search')?.value || '').toLowerCase();
        const turnoF = document.getElementById('pend-filter-turno')?.value || 'todos';
        
        const pendentesObrigatorios = (this.allColaboradores || []).filter(c => {
            // Only care about missing tests
            if (c.statusDia !== 'PENDENTE') return false;
            
            // Reapply filters to copy only what is being searched 
            if (term && !(c.name || '').toLowerCase().includes(term) && !(c.function || '').toLowerCase().includes(term)) return false;
            if (turnoF !== 'todos' && !(c.turnoNormalizado || '').toUpperCase().includes(turnoF)) return false;
            
            return true;
        });

        if (pendentesObrigatorios.length === 0) {
            if (window.SGE_ETL.helpers && window.SGE_ETL.helpers.toast) {
                window.SGE_ETL.helpers.toast("Nenhum colaborador pendente para copiar.", "warning");
            } else {
                alert("Nenhum colaborador pendente para copiar.");
            }
            return;
        }
        
        const dateStr = new Date().toLocaleDateString('pt-BR');
        let text = `*Faltantes - Teste Etilômetro (${dateStr})*\n\n`;
        
        // Group by regime
        const porRegime = {};
        pendentesObrigatorios.forEach(c => {
            const r = c.turnoNormalizado || 'Sem Turma';
            if (!porRegime[r]) porRegime[r] = [];
            porRegime[r].push(c);
        });
        
        Object.keys(porRegime).sort().forEach(r => {
            text += `*Turma ${r}*\n`;
            porRegime[r].forEach(c => {
                text += `- ${c.name} (${c.function || 'S/ Funç.'})\n`;
            });
            text += '\n';
        });
        
        navigator.clipboard.writeText(text).then(() => {
            if (window.SGE_ETL.helpers && window.SGE_ETL.helpers.toast) {
                window.SGE_ETL.helpers.toast('Lista copiada para a área de transferência!', 'success');
            } else {
                alert('Lista copiada!');
            }
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            alert('Erro ao copiar lista.');
        });
    }
};
