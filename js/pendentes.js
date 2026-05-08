'use strict';

/**
 * SGE_ETL — Lista de Chamada Inteligente
 * Combina testes de etilômetro (= PRESENTE) com cards de presença ricos
 * portados do Controle-De-Presença para registrar F, FE, FO, TR, AT, AF, TH, TE, EX.
 * Salva em efetivo_gps_mec_registros_presenca (mesma tabela do Controle-De-Presença).
 */
window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.pendentes = {
    allColaboradores:    [],
    attendanceRecords:   {}, // { empId: { status, extras } }
    _presencaLoaded:     {},
    _saveState:          'idle',
    _filterStatus:       'todos',
    _filterTurno:        'todos',
    _filterSearch:       '',

    // ─── LOAD ────────────────────────────────────────────────────────────────

    async load() {
        const container = document.getElementById('chamada-content');
        if (!window.supabase || !container) return;

        container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8;">Carregando lista de chamada...</div>';

        try {
            // Use session date if active, otherwise today
            const todayStr   = (SGE_ETL.state.plantao?.ativo && SGE_ETL.state.plantao?.data_plantao)
                ? SGE_ETL.state.plantao.data_plantao
                : new Date().toISOString().split('T')[0];
            const todayStart = new Date(todayStr + 'T00:00:00Z').toISOString();
            const todayEnd   = new Date(todayStr + 'T23:59:59Z').toISOString();

            // Show the date being loaded in the header
            const header = document.querySelector('#pendentes-view h2');
            if (header) {
                const [y,m,d] = todayStr.split('-');
                header.textContent = `Lista de Chamada — ${d}/${m}/${y}`;
            }

            const [colabRes, testRes, presRes] = await Promise.all([
                window.supabase.schema('gps_mec')
                    .from('efetivo_gps_mec_colaboradores')
                    .select('id, name, function, regime, category, status, supervisor_id')
                    .eq('status', 'ATIVO')
                    .eq('category', 'OPERACIONAL')
                    .order('name'),
                window.supabase.schema('gps_mec')
                    .from('efetivo_gps_mec_etilometria')
                    .select('colaborador_id, colaborador_nome, resultado, etl_status:status')
                    .gte('data_hora', todayStart)
                    .lte('data_hora', todayEnd),
                window.supabase.schema('gps_mec')
                    .from('efetivo_gps_mec_registros_presenca')
                    .select('employee_id, status, observations, has_justification, replacement_employee_id, replacement_employee_name, training_type, new_schedule, scale_change_date, scale_change_target, has_replacement')
                    .eq('date', todayStr)
            ]);

            if (colabRes.error) throw colabRes.error;
            if (testRes.error)  throw testRes.error;
            // presença records error is non-fatal
            if (presRes.error) console.warn('Presença load error:', presRes.error.message);

            const testedById   = {};
            const testedByName = new Set();
            (testRes.data || []).forEach(t => {
                if (t.colaborador_id) testedById[t.colaborador_id] = t;
                if (t.colaborador_nome) testedByName.add(t.colaborador_nome.trim().toUpperCase());
            });

            // Restore saved attendance records from DB (don't override if already edited)
            this._presencaLoaded = {};
            (presRes.data || []).forEach(r => {
                this._presencaLoaded[r.employee_id] = {
                    status: r.status,
                    extras: {
                        observations: r.observations || '',
                        has_justification: r.has_justification,
                        replacement_employee_id: r.replacement_employee_id,
                        replacement_employee_name: r.replacement_employee_name,
                        training_type: r.training_type,
                        new_schedule: r.new_schedule,
                        scale_change_date: r.scale_change_date,
                        scale_change_target: r.scale_change_target,
                        has_replacement: r.has_replacement
                    }
                };
                // Merge into attendanceRecords only if not already edited this session
                if (!this.attendanceRecords[r.employee_id]) {
                    this.attendanceRecords[r.employee_id] = this._presencaLoaded[r.employee_id];
                }
            });

            // Calculate folgas de hoje para exibir nos chips
            const shiftsOff = [];
            ['A','B','C','D','ADM'].forEach(s => {
                if (SGE_ETL.helpers.calcularTurno(todayStr, s) === 'F') shiftsOff.push(s);
            });

            this.allColaboradores = (colabRes.data || []).map(c => {
                const turno    = c.regime ? SGE_ETL.helpers.calcularTurno(todayStr, c.regime) : null;
                const nomeMaius = (c.name || '').trim().toUpperCase();
                const testInfo = testedById[c.id] || (testedByName.has(nomeMaius) ? { result_from_name: true } : null);

                return {
                    id:          c.id,
                    name:        c.name,
                    funcao:      c.function || '—',
                    regime:      c.regime   || '—',
                    supervisor_id: c.supervisor_id || null,
                    turnoHoje:   turno,
                    isPresente:  !!testInfo,
                    isFolga:     turno === 'F',
                    testInfo:    testInfo && testedById[c.id] ? testedById[c.id] : null
                };
            });
            this.allColaboradores = this.allColaboradores.filter(c => c.turnoHoje !== '19');

            this._updateStats(shiftsOff);
            this.render();

        } catch (err) {
            const container = document.getElementById('chamada-content');
            if (container) container.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;">Erro ao carregar: ${err.message}</div>`;
            console.error('Lista de Chamada load error:', err);
        }
    },

    // ─── STATS ───────────────────────────────────────────────────────────────

    _updateStats(shiftsOff) {
        const total = this.allColaboradores.length;
        let presentes = 0, folgas = 0, registrados = 0, pendentes = 0;

        this.allColaboradores.forEach(c => {
            if (c.isFolga) { folgas++; return; }
            if (c.isPresente) { presentes++; return; }
            if (this.attendanceRecords[c.id]) { registrados++; return; }
            pendentes++;
        });

        const escalados = total - folgas;
        const marcados  = presentes + registrados;
        const pct       = escalados > 0 ? Math.round((marcados / escalados) * 100) : 0;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pend-total',     escalados);
        set('pend-testados',  presentes);
        set('pend-ausentes',  registrados);
        set('pend-pendentes', pendentes);
        set('pend-folgas',    shiftsOff && shiftsOff.length ? shiftsOff.join(', ') : folgas || 'Nenhuma');
        set('stat-testes-menu', presentes);

        // Progress
        const pBar = document.getElementById('chamada-progress-bar');
        const pTxt = document.getElementById('chamada-progress-txt');
        if (pBar) pBar.style.width = pct + '%';
        if (pTxt) pTxt.textContent = `${pct}% registrados · ${marcados}/${escalados} escalados`;
    },

    // ─── RENDER ──────────────────────────────────────────────────────────────

    render() {
        const container = document.getElementById('chamada-content');
        if (!container) return;

        const term   = this._filterSearch.toLowerCase();
        const sFilt  = this._filterStatus;
        const tFilt  = this._filterTurno;

        const filtered = this.allColaboradores.filter(c => {
            if (term && !(c.name || '').toLowerCase().includes(term)) return false;
            if (tFilt !== 'todos' && !(c.regime || '').toUpperCase().includes(tFilt)) return false;
            if (sFilt !== 'todos') {
                const st = this._getCardStatus(c);
                if (sFilt === 'PRESENTE'   && st !== 'PRESENTE')   return false;
                if (sFilt === 'PENDENTE'   && st !== 'PENDENTE')   return false;
                if (sFilt === 'REGISTRADO' && st !== 'REGISTRADO') return false;
                if (sFilt === 'FOLGA'      && st !== 'FOLGA')      return false;
            }
            return true;
        });

        // Sort: PENDENTE → REGISTRADO → PRESENTE → FOLGA
        const order = { PENDENTE: 0, REGISTRADO: 1, PRESENTE: 2, FOLGA: 3 };
        filtered.sort((a, b) => (order[this._getCardStatus(a)] ?? 9) - (order[this._getCardStatus(b)] ?? 9));

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;font-size:14px;">
                ${sFilt === 'PENDENTE' ? 'Todos os colaboradores escalados foram contabilizados.' : 'Nenhum colaborador encontrado com este filtro.'}
            </div>`;
            return;
        }

        container.innerHTML = `<div class="chamada-grid">${filtered.map(c => this._renderCard(c)).join('')}</div>
        <div class="chamada-save-footer">
            ${this._renderSaveBtn()}
        </div>`;

        this._updateStats();
    },

    _getCardStatus(c) {
        if (c.isFolga)   return 'FOLGA';
        if (c.isPresente) return 'PRESENTE';
        if (this.attendanceRecords[c.id]) return 'REGISTRADO';
        return 'PENDENTE';
    },

    _renderCard(c) {
        const status  = this._getCardStatus(c);
        const record  = this.attendanceRecords[c.id];
        const turnoLabel = c.turnoHoje === '07' ? '07h–19h'
                         : c.turnoHoje === 'ADM' ? 'ADM'
                         : c.turnoHoje ? c.turnoHoje : '—';

        let cardClass = 'chamada-card';
        let statusBadge = '';
        let bodyHTML = '';

        if (status === 'PRESENTE') {
            cardClass += ' chamada-card--locked chamada-card--presente';
            statusBadge = `<span class="chamada-badge" style="background:#dcfce7;color:#166534;border:1px solid #86efac;">PRESENTE</span>`;
            const ti = c.testInfo;
            if (ti) {
                const col = SGE_ETL.helpers.statusColor(ti.etl_status || ti.status);
                bodyHTML = `<div class="chamada-teste-result">${parseFloat(ti.resultado).toFixed(2)} mg/L — <strong style="color:${col};">${ti.etl_status || ti.status}</strong></div>`;
            } else {
                bodyHTML = `<div class="chamada-teste-result">Teste registrado hoje</div>`;
            }

        } else if (status === 'FOLGA') {
            cardClass += ' chamada-card--locked chamada-card--folga';
            statusBadge = `<span class="chamada-badge" style="background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;">FOLGA 4x4</span>`;

        } else if (status === 'REGISTRADO') {
            const sc = SGE_ETL.chamadaModal.STATUS_CODES[record.status];
            if (sc) statusBadge = `<span class="chamada-badge" style="background:${sc.bg};color:${sc.text};border:1px solid ${sc.color}40;">${sc.label}</span>`;
            bodyHTML = this._renderStatusGrid(c, record.status) + this._renderExtras(record.extras || {});

        } else {
            cardClass += ' chamada-card--pendente';
            statusBadge = `<span class="chamada-badge" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">PENDENTE</span>`;
            bodyHTML = this._renderStatusGrid(c, null);
        }

        return `
        <div class="${cardClass}" id="card-${c.id}">
            <div class="chamada-card-top">
                <div class="chamada-card-name">${c.name}</div>
                ${statusBadge}
            </div>
            <div class="chamada-card-meta">
                <span class="chamada-badge" style="background:#eff6ff;color:#1d4ed8;">${c.funcao}</span>
                <span class="chamada-badge" style="background:#f1f5f9;color:#475569;font-family:monospace;">Turma ${c.regime}</span>
                <span class="chamada-badge" style="background:#f8fafc;color:#94a3b8;">${turnoLabel}</span>
            </div>
            ${bodyHTML}
        </div>`;
    },

    _renderStatusGrid(c, currentStatus) {
        const codes = SGE_ETL.chamadaModal.STATUS_CODES;
        const buttons = Object.entries(codes).map(([code, info]) => {
            const isActive = currentStatus === code;
            const style = isActive ? `background:${info.bg};color:${info.text};border-color:${info.color};` : '';
            return `<button class="chamada-status-btn${isActive ? ' active' : ''}" style="${style}"
                onclick="SGE_ETL.pendentes.setStatus('${c.id}','${code}')">${info.label}</button>`;
        }).join('');
        return `<div class="chamada-status-grid">${buttons}</div>`;
    },

    _renderExtras(extras) {
        if (!extras) return '';
        const tags = [];
        if (extras.has_justification === true)        tags.push('Justificativa');
        if (extras.has_justification === false)       tags.push('Sem Justificativa');
        if (extras.replacement_employee_name)         tags.push('Substituto: ' + extras.replacement_employee_name);
        if (extras.training_type)                     tags.push('Treino: ' + extras.training_type);
        if (extras.new_schedule)                      tags.push('Horario: ' + extras.new_schedule);
        if (extras.scale_change_target)               tags.push('Escala: ' + extras.scale_change_target);

        let html = '';
        if (tags.length) {
            html += `<div class="chamada-extras">${tags.map(t => `<span class="chamada-extra-tag">${t}</span>`).join('')}</div>`;
        }
        if (extras.observations) {
            html += `<div class="chamada-obs-preview">${extras.observations}</div>`;
        }
        return html;
    },

    _renderSaveBtn() {
        const count = Object.keys(this.attendanceRecords).length;
        const states = {
            idle:    { text: `Salvar ${count} Registro${count !== 1 ? 's' : ''}`, disabled: count === 0 },
            saving:  { text: 'Salvando...', disabled: true },
            success: { text: 'Salvo com Sucesso', disabled: true },
            error:   { text: 'Erro ao Salvar', disabled: true }
        };
        const s = states[this._saveState] || states.idle;
        return `<button class="chamada-save-btn ${this._saveState}" ${s.disabled ? 'disabled' : ''} onclick="SGE_ETL.pendentes.saveAll()">${s.text}</button>`;
    },

    // ─── STATUS ACTIONS ──────────────────────────────────────────────────────

    setStatus(empId, status) {
        const modal = SGE_ETL.chamadaModal;
        if (modal.needsModal(status)) {
            modal.open(empId, status);
        } else {
            this.setAttendanceRecord(empId, status, {});
        }
    },

    setAttendanceRecord(empId, status, extras) {
        this.attendanceRecords[empId] = { status, extras: extras || {} };
        // Re-render just this card
        const cardEl = document.getElementById('card-' + empId);
        const c = this.allColaboradores.find(x => x.id === empId);
        if (cardEl && c) cardEl.outerHTML = this._renderCard(c);
        // Update save button
        const footer = document.querySelector('.chamada-save-footer');
        if (footer) footer.innerHTML = this._renderSaveBtn();
        this._updateStats();
        SGE_ETL.helpers.toast(`Registrado: ${SGE_ETL.chamadaModal.STATUS_CODES[status]?.label || status}`, 'info');
    },

    // ─── SAVE ────────────────────────────────────────────────────────────────

    async saveAll() {
        const records = Object.entries(this.attendanceRecords);
        if (!records.length) { SGE_ETL.helpers.toast('Nada a salvar', 'info'); return; }

        this._saveState = 'saving';
        this.render();

        const todayStr = new Date().toISOString().split('T')[0];
        const operador = SGE_ETL.state.plantao?.operador || SGE_ETL.state.user?.nome || 'Sistema';

        const rows = records.map(([empId, rec]) => {
            const c      = this.allColaboradores.find(x => x.id === empId);
            const status = typeof rec === 'string' ? rec : rec.status;
            const extras = typeof rec === 'object' ? (rec.extras || {}) : {};
            return {
                employee_id:             empId,
                supervisor_id:           c?.supervisor_id || null,
                date:                    todayStr,
                status,
                observations:            extras.observations || null,
                has_justification:       extras.has_justification ?? null,
                replacement_employee_id: extras.replacement_employee_id || null,
                replacement_employee_name: extras.replacement_employee_name || null,
                training_type:           extras.training_type || null,
                new_schedule:            extras.new_schedule || null,
                scale_change_date:       extras.scale_change_date || null,
                scale_change_target:     extras.scale_change_target || null,
                has_replacement:         extras.has_replacement ?? null,
                created_by_name:         operador,
                updated_at:              new Date().toISOString()
            };
        }).filter(r => r.supervisor_id !== null); // only save records with valid supervisor

        const res = await SGE_ETL.api.savePresencaRegistros(rows);
        if (res.success) {
            this._saveState = 'success';
            SGE_ETL.helpers.toast('Presenças salvas com sucesso!', 'success');
        } else {
            this._saveState = 'error';
            SGE_ETL.helpers.toast('Erro ao salvar: ' + res.error, 'error');
        }
        this.render();
        setTimeout(() => { this._saveState = 'idle'; this.render(); }, 2500);
    },

    // ─── COPY ────────────────────────────────────────────────────────────────

    copiarFaltantes() {
        const pendentes = this.allColaboradores.filter(c => this._getCardStatus(c) === 'PENDENTE');
        if (!pendentes.length) { SGE_ETL.helpers.toast('Nenhum colaborador pendente', 'info'); return; }
        const dateStr = new Date().toLocaleDateString('pt-BR');
        let text = `*Pendentes — Etilômetro (${dateStr})*\n\n`;
        const por = {};
        pendentes.forEach(c => { const r = c.regime || 'S/ Turma'; if (!por[r]) por[r] = []; por[r].push(c); });
        Object.keys(por).sort().forEach(r => {
            text += `*Turma ${r}*\n`;
            por[r].forEach(c => { text += `- ${c.name} (${c.funcao})\n`; });
            text += '\n';
        });
        navigator.clipboard.writeText(text)
            .then(() => SGE_ETL.helpers.toast('Lista copiada!', 'success'))
            .catch(() => SGE_ETL.helpers.toast('Erro ao copiar', 'error'));
    },

    // ─── INIT ────────────────────────────────────────────────────────────────

    init() {
        document.getElementById('btn-refresh-pendentes')?.addEventListener('click', () => {
            this.attendanceRecords = {};
            this.load();
        });
        document.getElementById('btn-copiar-pendentes')?.addEventListener('click', () => this.copiarFaltantes());

        document.getElementById('pend-search')?.addEventListener('input', e => {
            this._filterSearch = e.target.value;
            this.applyFilters();
        });

        document.getElementById('pend-filter-status')?.addEventListener('change', e => {
            this._filterStatus = e.target.value;
            this.applyFilters();
        });

        document.getElementById('pend-filter-turno')?.addEventListener('change', e => {
            this._filterTurno = e.target.value;
            this.applyFilters();
        });
    },

    applyFilters() {
        this._filterSearch = (document.getElementById('pend-search')?.value || '');
        this._filterStatus = (document.getElementById('pend-filter-status')?.value || 'todos');
        this._filterTurno  = (document.getElementById('pend-filter-turno')?.value || 'todos');
        this.render();
    },

    _updateStats() {
        const total = this.allColaboradores.length;
        let presentes = 0, folgas = 0, registrados = 0, pendentes = 0;
        this.allColaboradores.forEach(c => {
            const st = this._getCardStatus(c);
            if (st === 'PRESENTE')   presentes++;
            else if (st === 'FOLGA') folgas++;
            else if (st === 'REGISTRADO') registrados++;
            else pendentes++;
        });
        const escalados = total - folgas;
        const marcados  = presentes + registrados;
        const pct       = escalados > 0 ? Math.round((marcados / escalados) * 100) : 0;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pend-total',      escalados);
        set('pend-testados',   presentes);
        set('pend-ausentes',   registrados);
        set('pend-pendentes',  pendentes);
        set('stat-testes-menu', presentes);

        const pBar = document.getElementById('chamada-progress-bar');
        const pTxt = document.getElementById('chamada-progress-txt');
        if (pBar) pBar.style.width = pct + '%';
        if (pTxt) pTxt.textContent = `${pct}% registrados · ${marcados}/${escalados} escalados`;

        // Update save button count
        const count = Object.keys(this.attendanceRecords).length;
        const footer = document.querySelector('.chamada-save-footer');
        if (footer && this._saveState === 'idle') footer.innerHTML = this._renderSaveBtn();
    }
};
