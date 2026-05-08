'use strict';

/**
 * SGE_ETL — Chamada Modal
 * Modal rico de status de presença portado do Controle-De-Presença.
 * Usado na Lista de Chamada para registrar F, AT, AF, TR, FO, FE, EX, TH, TE.
 */
window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.chamadaModal = {
    _overlay: null,
    _currentEmpId: null,
    _currentStatus: null,
    _formData: {},
    _allEmployees: [],

    STATUS_CODES: {
        'F':  { label: 'Falta',          color: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
        'FE': { label: 'Férias',         color: '#f59e0b', bg: '#fef3c7', text: '#92400e', direct: true },
        'TR': { label: 'Treinamento',    color: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },
        'AF': { label: 'Afastado',       color: '#6b7280', bg: '#e5e7eb', text: '#374151' },
        'AT': { label: 'Atestado',       color: '#f97316', bg: '#fed7aa', text: '#9a3412' },
        'FO': { label: 'Folga',          color: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6', direct: true },
        'EX': { label: 'Extra',          color: '#14b8a6', bg: '#ccfbf1', text: '#115e59', direct: true },
        'TH': { label: 'Troca Horário',  color: '#ec4899', bg: '#fce7f3', text: '#9f1239' },
        'TE': { label: 'Troca Escala',   color: '#06b6d4', bg: '#cffafe', text: '#164e63' },
    },

    SUBMENU_STATUSES: ['F', 'AT', 'AF', 'TR', 'TH', 'TE'],
    TRAINING_TYPES:   ['NR-33', 'NR-35', 'NR-20', 'NR-10', 'NR-12'],
    SCALE_OPTIONS:    ['ADM', 'A', 'B', 'C', 'D'],

    needsModal(status) {
        return this.SUBMENU_STATUSES.includes(status);
    },

    async open(empId, status) {
        this._currentEmpId = empId;
        this._currentStatus = status;
        this._formData = {};

        if (!this._allEmployees.length) await this._loadAllEmployees();

        const emp = (SGE_ETL.pendentes.allColaboradores || []).find(c => c.id === empId);
        const info = this.STATUS_CODES[status];

        this._overlay = document.getElementById('chamada-modal-overlay');
        if (!this._overlay) return;

        this._overlay.innerHTML = this._buildHTML(emp, status, info);
        requestAnimationFrame(() => this._overlay.classList.add('active'));

        this._overlay.querySelector('.chamada-modal-btn-cancel')?.addEventListener('click', () => this.close());
        this._overlay.querySelector('.chamada-modal-btn-confirm')?.addEventListener('click', () => this._confirm());
        this._overlay.addEventListener('click', e => { if (e.target === this._overlay) this.close(); });

        this._bindFields(status);
    },

    close() {
        if (!this._overlay) return;
        this._overlay.classList.remove('active');
        setTimeout(() => { if (this._overlay) this._overlay.innerHTML = ''; }, 300);
    },

    _confirm() {
        const obs = this._overlay.querySelector('#cm-observation');
        if (obs) this._formData.observations = obs.value.trim();

        SGE_ETL.pendentes.setAttendanceRecord(this._currentEmpId, this._currentStatus, { ...this._formData });
        this.close();
    },

    async _loadAllEmployees() {
        if (!window.supabase) return;
        try {
            const { data } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_colaboradores')
                .select('id, name, function, regime, supervisor_id')
                .eq('status', 'ATIVO')
                .eq('category', 'OPERACIONAL')
                .order('name');
            this._allEmployees = (data || []).map(e => ({
                id: e.id,
                nome: e.name,
                funcao: e.function || '—',
                regime: e.regime || '—',
                supervisor_id: e.supervisor_id
            }));
        } catch (e) {
            console.error('ChamadaModal: load employees failed', e);
        }
    },

    _buildHTML(emp, status, info) {
        const empName = emp ? emp.name : 'Colaborador';
        const fields  = this._getFields(status);

        return `
        <div class="chamada-modal">
            <div class="chamada-modal-header">
                <div class="chamada-modal-dot" style="background:${info.color}"></div>
                <div>
                    <h2>${info.label}</h2>
                    <div class="chamada-modal-emp">${empName}</div>
                </div>
            </div>
            <div class="chamada-modal-body">
                ${fields}
                <div class="chamada-modal-field">
                    <label>Observação</label>
                    <textarea class="chamada-modal-textarea" id="cm-observation" placeholder="Texto livre para observações adicionais..."></textarea>
                </div>
            </div>
            <div class="chamada-modal-footer">
                <button class="chamada-modal-btn chamada-modal-btn-cancel">Cancelar</button>
                <button class="chamada-modal-btn chamada-modal-btn-confirm" style="background:${info.color};">Confirmar</button>
            </div>
        </div>`;
    },

    _getFields(status) {
        switch (status) {
            case 'F':  return this._fldJustification() + this._fldCoverage();
            case 'AT':
            case 'AF': return this._fldCoverage();
            case 'TR': return this._fldTrainingType() + this._fldCoverage();
            case 'TH': return this._fldNewSchedule();
            case 'TE': return this._fldScaleChange();
            default:   return '';
        }
    },

    _fldJustification() {
        return `<div class="chamada-modal-field">
            <label>Houve justificativa?</label>
            <div class="chamada-toggle-group">
                <button class="chamada-toggle-btn" data-field="has_justification" data-value="true">Sim</button>
                <button class="chamada-toggle-btn" data-field="has_justification" data-value="false">Não</button>
            </div>
        </div>`;
    },

    _fldCoverage() {
        return `<div class="chamada-modal-field">
            <label>Houve alguém cobrindo?</label>
            <div class="chamada-toggle-group">
                <button class="chamada-toggle-btn" data-field="has_coverage" data-value="true">Sim</button>
                <button class="chamada-toggle-btn" data-field="has_coverage" data-value="false">Não</button>
            </div>
        </div>
        <div class="chamada-modal-field" id="cm-coverage-field" style="display:none;">
            <label>Quem cobriu?</label>
            <div class="chamada-autocomplete-wrapper">
                <input class="chamada-modal-input" id="cm-coverage-input" placeholder="Digite o nome do colaborador..." autocomplete="off" />
                <div class="chamada-autocomplete-dropdown" id="cm-coverage-dropdown"></div>
            </div>
            <div id="cm-coverage-selected" style="display:none;"></div>
        </div>`;
    },

    _fldTrainingType() {
        const opts = this.TRAINING_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
        return `<div class="chamada-modal-field">
            <label>Qual treinamento?</label>
            <select class="chamada-modal-select" id="cm-training">
                <option value="">Selecione...</option>${opts}
                <option value="OUTRO">Outro (digitar)</option>
            </select>
        </div>
        <div class="chamada-modal-field" id="cm-training-custom-wrap" style="display:none;">
            <label>Nome do treinamento</label>
            <input class="chamada-modal-input" id="cm-training-custom" placeholder="Digite o nome..." />
        </div>`;
    },

    _fldNewSchedule() {
        return `<div class="chamada-modal-field">
            <label>Para qual horário?</label>
            <input class="chamada-modal-input" id="cm-new-schedule" placeholder="Ex: 07:00 às 17:00" />
        </div>`;
    },

    _fldScaleChange() {
        const opts = this.SCALE_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
        return `<div class="chamada-modal-field">
            <label>Dia da troca</label>
            <input class="chamada-modal-input" type="date" id="cm-scale-date" />
        </div>
        <div class="chamada-modal-field">
            <label>Para qual escala?</label>
            <select class="chamada-modal-select" id="cm-scale-target">
                <option value="">Selecione...</option>${opts}
            </select>
        </div>`;
    },

    _bindFields(status) {
        this._bindToggles();

        if (['F', 'AT', 'AF', 'TR'].includes(status)) this._bindCoverage();
        if (status === 'TR') this._bindTraining();
        if (status === 'TH') {
            this._overlay.querySelector('#cm-new-schedule')?.addEventListener('input', e => {
                this._formData.new_schedule = e.target.value;
            });
        }
        if (status === 'TE') {
            this._overlay.querySelector('#cm-scale-date')?.addEventListener('change', e => {
                this._formData.scale_change_date = e.target.value;
            });
            this._overlay.querySelector('#cm-scale-target')?.addEventListener('change', e => {
                this._formData.scale_change_target = e.target.value;
            });
        }
    },

    _bindToggles() {
        this._overlay.querySelectorAll('.chamada-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const value = btn.dataset.value === 'true';
                this._formData[field] = value;
                const group = btn.closest('.chamada-toggle-group');
                group.querySelectorAll('.chamada-toggle-btn').forEach(b => b.classList.remove('selected-yes','selected-no'));
                btn.classList.add(value ? 'selected-yes' : 'selected-no');
                if (field === 'has_coverage') {
                    const coverField = this._overlay.querySelector('#cm-coverage-field');
                    if (coverField) coverField.style.display = value ? 'flex' : 'none';
                    if (!value) { this._formData.replacement_employee_id = null; this._formData.replacement_employee_name = null; }
                }
            });
        });
    },

    _bindCoverage() {
        const input    = this._overlay.querySelector('#cm-coverage-input');
        const dropdown = this._overlay.querySelector('#cm-coverage-dropdown');
        if (input && dropdown) this._setupAutocomplete(input, dropdown, '#cm-coverage-selected');
    },

    _bindTraining() {
        const sel    = this._overlay.querySelector('#cm-training');
        const wrap   = this._overlay.querySelector('#cm-training-custom-wrap');
        const custom = this._overlay.querySelector('#cm-training-custom');
        sel?.addEventListener('change', () => {
            if (sel.value === 'OUTRO') {
                wrap.style.display = 'flex';
                this._formData.training_type = '';
            } else {
                wrap.style.display = 'none';
                this._formData.training_type = sel.value;
            }
        });
        custom?.addEventListener('input', () => { this._formData.training_type = custom.value; });
    },

    _setupAutocomplete(input, dropdown, selectedSel) {
        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            if (q.length < 2) { dropdown.classList.remove('visible'); return; }

            const results = this._allEmployees.filter(e =>
                e.id !== this._currentEmpId && e.nome.toLowerCase().includes(q)
            ).slice(0, 15);

            if (!results.length) {
                dropdown.innerHTML = '<div class="chamada-autocomplete-empty">Nenhum colaborador encontrado</div>';
                dropdown.classList.add('visible');
                return;
            }

            dropdown.innerHTML = results.map(e => {
                const hi = e.nome.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<span class="autocomplete-match">$1</span>');
                return `<div class="chamada-autocomplete-item" data-id="${e.id}" data-name="${e.nome}">
                    <div>${hi}</div>
                    <div class="autocomplete-meta">${e.funcao} • Turma ${e.regime}</div>
                </div>`;
            }).join('');

            dropdown.classList.add('visible');

            dropdown.querySelectorAll('.chamada-autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    this._formData.replacement_employee_id   = item.dataset.id;
                    this._formData.replacement_employee_name = item.dataset.name;
                    input.style.display = 'none';
                    dropdown.classList.remove('visible');
                    const sel = this._overlay.querySelector(selectedSel);
                    sel.style.display = 'block';
                    sel.innerHTML = `<div class="chamada-selected-emp">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        ${item.dataset.name}
                        <span class="chamada-selected-remove" title="Remover">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </span>
                    </div>`;
                    sel.querySelector('.chamada-selected-remove').addEventListener('click', () => {
                        this._formData.replacement_employee_id   = null;
                        this._formData.replacement_employee_name = null;
                        sel.style.display = 'none';
                        input.style.display = 'block';
                        input.value = '';
                        input.focus();
                    });
                });
            });
        });

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('visible');
        }, { once: false });
    }
};
