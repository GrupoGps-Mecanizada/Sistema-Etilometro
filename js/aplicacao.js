'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.aplicacao = {
    init() {
        this.cacheElements();
        this.bindEvents();
        this.render();
    },

    cacheElements() {
        this.els = {
            view: document.getElementById('aplicacao-view'),
            setupPanel: document.getElementById('aplicacao-setup'),
            queuePanel: document.getElementById('aplicacao-queue'),

            // Setup
            inOperador: document.getElementById('setup-operador'),
            inNumSerie: document.getElementById('setup-num-serie'),
            inLocal: document.getElementById('setup-local'),
            btnStart: document.getElementById('btn-start-session'),

            // Queue
            inNome: document.getElementById('queue-nome'),
            inCpf: document.getElementById('queue-cpf'),
            inFuncao: document.getElementById('queue-funcao'),
            inObs: document.getElementById('queue-obs'),
            inResultado: document.getElementById('queue-resultado'),

            btnDec: document.getElementById('btn-result-dec'),
            btnInc: document.getElementById('btn-result-inc'),
            statusBadge: document.getElementById('fast-status-badge'),

            btnConfirm: document.getElementById('btn-sig-confirm'),
            btnEnd: document.getElementById('btn-end-session'),
            sessionInfo: document.getElementById('current-session-info')
        };
    },

    render() {
        if (!this.els.view) return;

        if (SGE_ETL.state.plantao.ativo) {
            this.els.setupPanel.classList.add('hidden');
            this.els.queuePanel.classList.remove('hidden');
            this.els.sessionInfo.innerHTML = `<strong>${SGE_ETL.state.plantao.aparelho}</strong> • ${SGE_ETL.state.plantao.local}`;
            this.els.inNome.focus();
            setTimeout(() => {
                if (SGE_ETL.signature) SGE_ETL.signature.resizeCanvas();
            }, 100);
        } else {
            this.els.setupPanel.classList.remove('hidden');
            this.els.queuePanel.classList.add('hidden');
            if (SGE_ETL.state.user && !this.els.inOperador.value) {
                this.els.inOperador.value = SGE_ETL.state.user.nome;
            }
        }
    },

    resetQueueForm() {
        this.els.inNome.value = '';
        this.els.inCpf.value = '';
        this.els.inFuncao.value = '';
        this.els.inObs.value = '';
        this.els.inResultado.value = '0.00';
        this.updateStatusBadge();
        this.els.inNome.focus();
        if (SGE_ETL.signature) SGE_ETL.signature.clear();
    },

    updateStatusBadge() {
        const val = parseFloat(this.els.inResultado.value) || 0;
        let status = 'NEGATIVO';
        if (val > 0 && val < 0.05) status = 'ATENÇÃO';
        if (val >= 0.05) status = 'POSITIVO';

        this.els.statusBadge.textContent = status;
        this.els.statusBadge.style.color = SGE_ETL.helpers.statusColor(status);
    },

    incrementResult(amount) {
        let current = parseFloat(this.els.inResultado.value) || 0;
        current += amount;
        if (current < 0) current = 0;
        this.els.inResultado.value = current.toFixed(2);
        this.updateStatusBadge();
    },

    bindEvents() {
        if (!this.els.view) return;

        this.els.btnStart.addEventListener('click', async () => {
            const op = this.els.inOperador.value.trim();
            const serie = this.els.inNumSerie.value.trim();
            const loc = this.els.inLocal.value.trim();

            if (!op || !serie || !loc) {
                SGE_ETL.helpers.toast('Preencha Operador, Aparelho e Local', 'error');
                return;
            }

            const originalBtn = this.els.btnStart.innerHTML;
            if (SGE_ETL.CONFIG.efetivoUrl && navigator.onLine && (!SGE_ETL.state.colaboradores || SGE_ETL.state.colaboradores.length === 0)) {
                this.els.btnStart.innerHTML = `<i data-lucide="loader" class="rotating"></i> Sincronizando BD...`;
                this.els.btnStart.disabled = true;

                const res = await SGE_ETL.api.fetchColaboradores();
                if (res.success && res.data) {
                    SGE_ETL.state.colaboradores = res.data;
                } else {
                    console.warn("Sincronização de colaboradores falhou:", res.error);
                }

                this.els.btnStart.innerHTML = originalBtn;
                this.els.btnStart.disabled = false;
                if (window.lucide) window.lucide.createIcons();
            }

            SGE_ETL.state.plantao = { ativo: true, operador: op, aparelho: serie, local: loc };
            this.render();
            SGE_ETL.helpers.toast('Plantão Iniciado');
        });

        this.els.btnEnd.addEventListener('click', () => {
            if (confirm("Deseja realmente encerrar a aplicação?")) {
                SGE_ETL.state.plantao.ativo = false;
                this.resetQueueForm();
                this.render();
            }
        });

        this.els.btnDec.addEventListener('click', () => this.incrementResult(-0.01));
        this.els.btnInc.addEventListener('click', () => this.incrementResult(0.01));
        this.els.inResultado.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 0) val = 0;
            e.target.value = val.toFixed(2);
            this.updateStatusBadge();
        });

        if (this.els.btnConfirm) {
            this.els.btnConfirm.addEventListener('click', () => {
                const nome = this.els.inNome.value.trim();
                const func = this.els.inFuncao.value.trim();

                if (!nome || !func) {
                    SGE_ETL.helpers.toast('Nome e Função do colaborador são obrigatórios', 'error');
                    if (!nome) this.els.inNome.focus();
                    else this.els.inFuncao.focus();
                    return;
                }

                const payload = {
                    nomeTestado: nome,
                    cpfMatricula: this.els.inCpf.value.trim(),
                    postoFuncao: func,
                    resultado: this.els.inResultado.value,
                    status: this.els.statusBadge.textContent,
                    observacoes: this.els.inObs.value.trim()
                };

                // Confirm signature and save
                SGE_ETL.signature.confirm(payload);
            });
        }

        // --- AUTOCOMPLETE VIEW ---
        this.els.inNome.addEventListener('input', (e) => {
            this.handleAutocomplete(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                const list = document.getElementById('autocomplete-list');
                if (list) list.classList.add('hidden');
            }
        });
    },

    handleAutocomplete(query) {
        let list = document.getElementById('autocomplete-list');
        if (!list) {
            const wrapper = document.createElement('div');
            wrapper.className = 'autocomplete-wrapper';
            wrapper.style.position = 'relative';

            this.els.inNome.parentNode.insertBefore(wrapper, this.els.inNome);
            wrapper.appendChild(this.els.inNome);

            list = document.createElement('div');
            list.id = 'autocomplete-list';
            list.className = 'autocomplete-items hidden';
            wrapper.appendChild(list);

            const style = document.createElement('style');
            style.innerHTML = `
              .autocomplete-items { position: absolute; border: 1px solid var(--slate-200); border-top: none; z-index: 99; top: 100%; left: 0; right: 0; background: #fff; border-radius: 0 0 var(--radius-lg) var(--radius-lg); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-height: 200px; overflow-y: auto; }
              .autocomplete-item { padding: 10px; cursor: pointer; border-bottom: 1px solid var(--slate-100); font-size: 0.9rem; }
              .autocomplete-item:hover { background-color: var(--slate-50); }
              .autocomplete-match { font-weight: bold; color: var(--blue-600); }
              .autocomplete-sub { font-size: 0.75rem; color: var(--slate-500); }
            `;
            document.head.appendChild(style);
        }

        const colaboradores = SGE_ETL.state.colaboradores || [];
        const val = query.trim().toUpperCase();

        list.innerHTML = '';
        if (!val || colaboradores.length === 0) {
            list.classList.add('hidden');
            return;
        }

        const matches = colaboradores.filter(c =>
            (c.nome && c.nome.toUpperCase().includes(val)) ||
            (c.matricula_gps && String(c.matricula_gps).includes(val)) ||
            (c.telefone && String(c.telefone).includes(val))
        ).slice(0, 8);

        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }

        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';

            const regex = new RegExp(`(${val})`, "gi");
            const nomeStr = c.nome.replace(regex, "<span class='autocomplete-match'>$1</span>");

            div.innerHTML = `
               <div>${nomeStr}</div>
               <div class="autocomplete-sub">${c.funcao || 'N/A'} • Regime: ${c.regime || 'N/A'} ${c.matricula_gps ? '• GPS: ' + c.matricula_gps : ''}</div>
            `;

            div.addEventListener('click', () => {
                this.els.inNome.value = c.nome;
                // Use matricula or phone as fallback identifier
                this.els.inCpf.value = c.matricula_gps || c.telefone || '';
                this.els.inFuncao.value = c.funcao || '';
                if (c.regime && c.regime.trim() !== '') {
                    this.els.inFuncao.value = `${c.funcao} (${c.regime})`;
                }

                list.classList.add('hidden');
            });
            list.appendChild(div);
        });

        list.classList.remove('hidden');
    }
};
