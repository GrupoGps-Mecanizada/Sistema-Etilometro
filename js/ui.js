// js/ui.js
// Handles DOM updates and UI transitions for High Volume Flow

const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Check if session exists
        this.renderInitialView();
    },

    cacheElements() {
        this.elements = {
            currentTime: document.getElementById('current-time'),
            topbarTitle: document.getElementById('topbar-title'),
            topbarIcon: document.getElementById('topbar-mode-icon'),

            views: {
                setup: document.getElementById('view-setup'),
                queue: document.getElementById('view-queue'),
                history: document.getElementById('view-history'),
                signature: document.getElementById('view-signature'),
                search: document.getElementById('view-search')
            },

            // Setup
            setupOperador: document.getElementById('setup-operador'),
            setupNumSerie: document.getElementById('setup-num-serie'),
            setupLocal: document.getElementById('setup-local'),
            btnStartSession: document.getElementById('btn-start-session'),

            // Queue (Main Loop)
            queueNome: document.getElementById('queue-nome'),
            queueCpf: document.getElementById('queue-cpf'),
            queueFuncao: document.getElementById('queue-funcao'),
            queueResultado: document.getElementById('queue-resultado'),
            queueObs: document.getElementById('queue-obs'),
            btnGoSignature: document.getElementById('btn-go-signature'),
            btnEndSession: document.getElementById('btn-end-session'),
            counterBadge: document.getElementById('counter-badge'),

            fastStatusBadge: document.getElementById('fast-status-badge'),
            btnResultDec: document.getElementById('btn-result-dec'),
            btnResultInc: document.getElementById('btn-result-inc'),

            // Settings / History Toolbars
            btnConfigToggle: document.getElementById('btn-config-toggle'),
            settingsPanel: document.getElementById('settings-panel'),
            configUrl: document.getElementById('config-url'),
            configEfetivoUrl: document.getElementById('config-efetivo-url'),

            btnHistoryToggle: document.getElementById('btn-history-toggle'),
            btnCloseHistory: document.getElementById('btn-close-history'),
            historyList: document.getElementById('history-list'),

            // Signature 
            btnSigCancel: document.getElementById('btn-sig-cancel'),
            btnSigConfirm: document.getElementById('btn-sig-confirm'),
            sigNome: document.getElementById('sig-nome'),
            sigResultado: document.getElementById('sig-resultado'),

            // Search view
            btnSearchToggle: document.getElementById('btn-search-toggle'),
            btnCloseSearch: document.getElementById('btn-close-search'),
            searchInput: document.getElementById('search-input'),
            btnDoSearch: document.getElementById('btn-do-search'),
            searchLoading: document.getElementById('search-loading'),
            searchResults: document.getElementById('search-results')
        };

        const state = window.SGE_ETILOMETRIA.State;
        this.elements.configUrl.value = state.backendUrl;
        this.elements.configEfetivoUrl.value = state.efetivoUrl;
    },

    updateTime() {
        const now = new Date();
        this.elements.currentTime.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    renderInitialView() {
        const session = window.SGE_ETILOMETRIA.State.session;

        // Hide ALL
        Object.values(this.elements.views).forEach(v => v.classList.add('hidden'));

        if (session && session.active) {
            this.elements.views.queue.classList.remove('hidden');
            this.elements.topbarTitle.innerHTML = `Sessão Ativa<br/><span style="font-size: 10px; font-weight: normal">${session.operador}</span>`;
            this.elements.topbarIcon.style.backgroundColor = 'var(--success-text)';
            this.elements.topbarIcon.innerHTML = `<i data-lucide="check" style="color:white"></i>`;

            this.resetQueueView();
            this.renderHistoryCounter();
        } else {
            this.elements.views.setup.classList.remove('hidden');
            this.elements.topbarTitle.innerHTML = `Sessão<br/>Inativa`;
            this.elements.topbarIcon.style.backgroundColor = 'var(--slate-400)';
            this.elements.topbarIcon.innerHTML = `E`;

            // Auto-fill from last time maybe? (Not required, but good UX)
            // We start empty as per protocol.
        }

        // Re-render lucide
        lucide.createIcons();
    },

    showSignature() {
        const sge = window.SGE_ETILOMETRIA;
        const test = sge.State.currentTest;

        this.elements.views.queue.classList.add('hidden');
        this.elements.views.signature.classList.remove('hidden');

        this.elements.sigNome.textContent = test.nomeTestado || 'NÃO INFORMADO';
        this.elements.sigResultado.textContent = test.resultado + ' mg/L';

        if (test.status === 'NEGATIVO') this.elements.sigResultado.style.color = "var(--success-text)";
        if (test.status === 'ATENÇÃO') this.elements.sigResultado.style.color = "var(--warning-text)";
        if (test.status === 'POSITIVO') this.elements.sigResultado.style.color = "var(--danger-text)";

        document.getElementById('app-header').classList.add('hidden');

        // IMPORTANT: Wait for DOM then resize canvas for landscape rotation
        setTimeout(() => {
            sge.Signature.resizeCanvas();
        }, 150);
    },

    hideSignature() {
        this.elements.views.signature.classList.add('hidden');
        this.elements.views.queue.classList.remove('hidden');
        document.getElementById('app-header').classList.remove('hidden');
        window.scrollTo(0, 0);
    },

    updateFastResultUI() {
        const test = window.SGE_ETILOMETRIA.State.currentTest;
        const badge = this.elements.fastStatusBadge;

        if (test.status === 'NEGATIVO') {
            badge.style.color = 'var(--success-text)';
            badge.textContent = 'NEGATIVO';
        } else if (test.status === 'ATENÇÃO') {
            badge.style.color = 'var(--warning-text)';
            badge.textContent = 'ATENÇÃO';
        } else {
            badge.style.color = 'var(--danger-text)';
            badge.textContent = 'POSITIVO';
        }
    },

    resetQueueView() {
        const sge = window.SGE_ETILOMETRIA;
        sge.State.resetCurrentTest();

        this.elements.queueNome.value = '';
        this.elements.queueCpf.value = '';
        this.elements.queueFuncao.value = '';
        this.elements.queueObs.value = '';
        this.elements.queueResultado.value = '0.00';

        this.updateFastResultUI();
        this.elements.queueNome.focus();

        sge.Signature.clear();
    },

    renderHistoryCounter() {
        const history = window.SGE_ETILOMETRIA.State.history;
        const today = new Date().toISOString().split('T')[0];

        const countToday = history.filter(h => h.timestamp.startsWith(today)).length;
        this.elements.counterBadge.textContent = `Hoje: ${countToday}`;
    },

    openHistory() {
        this.elements.views.setup.classList.add('hidden');
        this.elements.views.queue.classList.add('hidden');
        this.elements.views.history.classList.remove('hidden');

        const history = window.SGE_ETILOMETRIA.State.history;
        const list = this.elements.historyList;
        list.innerHTML = '';

        if (history.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-4">Nenhum teste registrado localmente.</div>`;
            return;
        }

        // Render cards
        history.forEach(h => {
            const isNeg = h.status === 'NEGATIVO';
            const isAtt = h.status === 'ATENÇÃO';
            const dateStr = new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const dotClass = isNeg ? 'negative' : (isAtt ? 'attention' : 'positive');

            list.innerHTML += `
        <div class="history-card">
          <div class="history-card-header">
            <span class="font-bold text-slate-800">${h.nomeTestado}</span>
            <span class="text-slate-400 text-xs">${dateStr}</span>
          </div>
          <div class="flex justify-between items-center text-slate-500 mt-2">
            <span class="font-mono text-xs">ID: ${h.id.split('-').pop()}</span>
            <div class="flex items-center gap-1 font-bold">
              <span class="status-dot ${dotClass}"></span>
              ${h.resultado}
            </div>
          </div>
        </div>
      `;
        });
    },

    openSearch() {
        this.elements.views.setup.classList.add('hidden');
        this.elements.views.queue.classList.add('hidden');
        this.elements.views.history.classList.add('hidden');
        this.elements.views.signature.classList.add('hidden');

        this.elements.views.search.classList.remove('hidden');
        if (this.elements.searchInput) {
            setTimeout(() => this.elements.searchInput.focus(), 100);
        }

        // Auto load diario
        this.elements.searchInput.value = '';
        this.doSearch(true); // pass true for "diario"
    },

    async doSearch(isDiario = false) {
        let q = this.elements.searchInput.value.trim();
        if (!isDiario && !q) return;

        this.elements.searchResults.innerHTML = '';
        this.elements.searchLoading.classList.remove('hidden');
        this.elements.btnDoSearch.disabled = true;

        const api = window.SGE_ETILOMETRIA.Api;
        const res = isDiario ? await api.loadDiario() : await api.searchEtilometria(q);

        this.elements.searchLoading.classList.add('hidden');
        this.elements.btnDoSearch.disabled = false;

        const list = this.elements.searchResults;

        if (!res.success) {
            list.innerHTML = `<div class="text-center text-red-500 py-4 text-sm">${res.error}</div>`;
            return;
        }

        if (res.data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">Nenhum resultado encontrado.</div>`;
            return;
        }

        res.data.forEach(h => {
            const isNeg = h.status === 'NEGATIVO';
            const isAtt = h.status === 'ATENÇÃO';
            const dotClass = isNeg ? 'negative' : (isAtt ? 'attention' : 'positive');

            // Formatação de Assinatura se tiver (Renderiza Imagem Base64 inline)
            const sigHtml = h.assinatura && h.assinatura.length > 50
                ? `<img src="${h.assinatura}" class="h-10 mt-2 border rounded bg-white shadow-sm" alt="Assinatura" />`
                : `<div class="text-xs text-slate-400 mt-2 italic">Sem assinatura na base</div>`;

            // Tratamento de conversão de data do Google Sheets se vier quebrado
            let dtLabel = h.data_hora || '';
            try {
                if (dtLabel.includes('T')) {
                    dtLabel = new Date(dtLabel).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                }
            } catch (e) { }

            list.innerHTML += `
            <div class="history-card" style="border-left: 4px solid var(--${isNeg ? 'success' : (isAtt ? 'warning' : 'danger')}-text)">
                <div class="history-card-header">
                <span class="font-bold text-slate-800">${h.colaborador || 'Sem Nome'}</span>
                <span class="text-slate-400 text-xs">${dtLabel}</span>
                </div>
                <div class="text-xs text-slate-500 mb-1 flex items-center gap-1">
                   <i data-lucide="tag" style="width:10px;height:10px"></i> ${h.funcao || ' - '} • ${h.cpf_mat || ' - '}
                </div>
                <div class="flex justify-between items-center text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                 <div class="flex flex-col text-xs space-y-1">
                   <span><strong class="text-slate-600">Aparelho:</strong> ${h.aparelho || '-'}</span>
                   <span><strong class="text-slate-600">Local:</strong> ${h.local || '-'}</span>
                   <span><strong class="text-slate-600">Operador:</strong> ${h.operador || '-'}</span>
                 </div>
                 <div class="flex flex-col items-end">
                    <div class="flex items-center gap-1 font-bold text-lg" style="color: var(--${isNeg ? 'success' : (isAtt ? 'warning' : 'danger')}-text)">
                        ${h.resultado} mg/L
                    </div>
                    <span class="text-[10px] font-bold tracking-widest uppercase">${h.status}</span>
                 </div>
                </div>
                ${sigHtml}
            </div>
            `;
        });

        // Render lucide icons for new elements
        lucide.createIcons();
    },

    incrementResult(amount) {
        const sge = window.SGE_ETILOMETRIA;
        let current = parseFloat(sge.State.currentTest.resultado) || 0;
        current += amount;
        if (current < 0) current = 0;

        const formatted = current.toFixed(2);
        this.elements.queueResultado.value = formatted;

        sge.State.updateResultContext(formatted);
        this.updateFastResultUI();
    },

    bindEvents() {
        const sge = window.SGE_ETILOMETRIA;
        const state = sge.State;

        // --- SETUP VIEW ---
        this.elements.btnStartSession.addEventListener('click', async () => {
            const op = this.elements.setupOperador.value.trim();
            const serie = this.elements.setupNumSerie.value.trim();
            const loc = this.elements.setupLocal.value.trim();

            if (!op || !serie || !loc) {
                alert("Preencha Operador, Série e Local para abrir a sessão.");
                return;
            }

            // Download colaboradores se possível
            const originalBtn = this.elements.btnStartSession.innerHTML;
            if (state.backendUrl && navigator.onLine) {
                this.elements.btnStartSession.innerHTML = `<i data-lucide="loader" class="rotating"></i> Sincronizando BD...`;
                this.elements.btnStartSession.disabled = true;

                const res = await sge.Api.fetchColaboradores();
                if (res.success && res.data) {
                    state.setColaboradores(res.data);
                } else {
                    console.warn("Sincronização falhou, usando cache offline", res.error);
                }

                this.elements.btnStartSession.innerHTML = originalBtn;
                this.elements.btnStartSession.disabled = false;
            }

            state.startSession(op, serie, loc);
            this.renderInitialView();
        });

        this.elements.btnConfigToggle.addEventListener('click', () => {
            this.elements.settingsPanel.classList.toggle('hidden');
        });

        this.elements.configUrl.addEventListener('input', (e) => {
            state.setBackendUrl(e.target.value.trim());
        });

        this.elements.configEfetivoUrl.addEventListener('input', (e) => {
            state.setEfetivoUrl(e.target.value.trim());
        });

        // --- QUEUE VIEW ---
        this.elements.btnResultDec.addEventListener('click', () => this.incrementResult(-0.01));
        this.elements.btnResultInc.addEventListener('click', () => this.incrementResult(0.01));

        this.elements.queueResultado.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 0) val = 0;
            const formatted = val.toFixed(2);
            e.target.value = formatted;
            state.updateResultContext(formatted);
            this.updateFastResultUI();
        });

        this.elements.btnEndSession.addEventListener('click', () => {
            if (confirm("Deseja realmente encerrar a sessão? Você terá que digitar Operador e Local novamente.")) {
                state.endSession();
                this.renderInitialView();
            }
        });

        // Track test inputs
        const trackEvent = (id, field) => {
            document.getElementById(id).addEventListener('input', (e) => state.updateTestField(field, e.target.value));
        };
        trackEvent('queue-nome', 'nomeTestado');
        trackEvent('queue-cpf', 'cpfMatricula');
        trackEvent('queue-funcao', 'postoFuncao');
        trackEvent('queue-obs', 'observacoes');

        // Goto Signature
        this.elements.btnGoSignature.addEventListener('click', () => {
            const test = state.currentTest;
            if (!test.nomeTestado || !test.funcao && !test.cpfMatricula) {
                // Alerting lightly for high volume. Name is absolutely required.
                if (!test.nomeTestado) {
                    alert("Nome do colaborador é obrigatório.");
                    this.elements.queueNome.focus();
                    return;
                }
            }
            this.showSignature();
        });

        // Voltar da Signature
        this.elements.btnSigCancel.addEventListener('click', () => {
            this.hideSignature();
        });

        // --- HISTORY VIEW ---
        this.elements.btnHistoryToggle.addEventListener('click', () => {
            this.openHistory();
        });
        this.elements.btnCloseHistory.addEventListener('click', () => {
            this.renderInitialView();
        });

        // --- SEARCH VIEW ---
        this.elements.btnSearchToggle.addEventListener('click', () => {
            this.openSearch();
        });
        this.elements.btnCloseSearch.addEventListener('click', () => {
            this.renderInitialView();
        });
        this.elements.btnDoSearch.addEventListener('click', () => {
            this.doSearch();
        });
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.doSearch();
        });

        // --- AUTOCOMPLETE VIEW ---
        this.elements.queueNome.addEventListener('input', (e) => {
            this.handleAutocomplete(e.target.value);
        });

        // Hide autocomplete on click outside
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
            // Create wrapper if not exists
            const wrapper = document.createElement('div');
            wrapper.className = 'autocomplete-wrapper';
            wrapper.style.position = 'relative';

            this.elements.queueNome.parentNode.insertBefore(wrapper, this.elements.queueNome);
            wrapper.appendChild(this.elements.queueNome);

            list = document.createElement('div');
            list.id = 'autocomplete-list';
            list.className = 'autocomplete-items hidden';
            wrapper.appendChild(list);

            // Add CSS dynamically for autocomplete
            const style = document.createElement('style');
            style.innerHTML = `
              .autocomplete-items {
                position: absolute;
                border: 1px solid var(--slate-200);
                border-top: none;
                z-index: 99;
                top: 100%;
                left: 0;
                right: 0;
                background: #fff;
                border-radius: 0 0 var(--radius-lg) var(--radius-lg);
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                max-height: 200px;
                overflow-y: auto;
              }
              .autocomplete-item {
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid var(--slate-100);
                font-size: 0.9rem;
              }
              .autocomplete-item:hover {
                background-color: var(--slate-50);
              }
              .autocomplete-match { font-weight: bold; color: var(--blue-600); }
              .autocomplete-sub { font-size: 0.75rem; color: var(--slate-500); }
            `;
            document.head.appendChild(style);
        }

        const colaboradores = window.SGE_ETILOMETRIA.State.colaboradores || [];
        const val = query.trim().toUpperCase();

        list.innerHTML = '';
        if (!val || colaboradores.length === 0) {
            list.classList.add('hidden');
            return;
        }

        // Search logic
        const matches = colaboradores.filter(c =>
            (c.nome && c.nome.toUpperCase().includes(val)) ||
            (c.matricula_gps && String(c.matricula_gps).includes(val)) ||
            (c.telefone && String(c.telefone).includes(val))
        ).slice(0, 8); // Max 8 results

        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }

        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';

            // Highlight match
            const regex = new RegExp(`(${val})`, "gi");
            const nomeStr = c.nome.replace(regex, "<span class='autocomplete-match'>$1</span>");

            div.innerHTML = `
               <div>${nomeStr}</div>
               <div class="autocomplete-sub">${c.funcao} • Regime: ${c.regime} ${c.matricula_gps ? '• GPS: ' + c.matricula_gps : ''}</div>
            `;

            div.addEventListener('click', () => {
                // Auto-fill form
                this.elements.queueNome.value = c.nome;
                this.elements.queueCpf.value = c.matricula_gps || c.telefone || ''; // Use matricula or phone as identifier if no cpf
                this.elements.queueFuncao.value = c.funcao;

                // Update state
                window.SGE_ETILOMETRIA.State.updateTestField('nomeTestado', c.nome);
                window.SGE_ETILOMETRIA.State.updateTestField('cpfMatricula', this.elements.queueCpf.value);
                window.SGE_ETILOMETRIA.State.updateTestField('postoFuncao', c.funcao);
                // We'll hijack observacoes or another field to inject Regime if we want, or rely on GAS to match.
                // Let's add Regime to Funcão to make it easy "Motorista - 24HS-A"
                if (c.regime && c.regime.trim() !== '') {
                    this.elements.queueFuncao.value = `${c.funcao} (${c.regime})`;
                    window.SGE_ETILOMETRIA.State.updateTestField('postoFuncao', this.elements.queueFuncao.value);
                }

                list.classList.add('hidden');

                // Read-only to avoid messing up the matched person (optional)
                this.elements.queueCpf.classList.add('bg-slate-50');
                this.elements.queueFuncao.classList.add('bg-slate-50');
            });
            list.appendChild(div);
        });

        list.classList.remove('hidden');
    }
};

window.SGE_ETILOMETRIA.UI = UI;
