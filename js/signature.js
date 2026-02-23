'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.signature = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    hasDrawn: false,

    init() {
        this.canvas = document.getElementById('signature-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.ctx.strokeStyle = '#0f3868';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.bindEvents();

        window.addEventListener('resize', () => {
            if (document.getElementById('signature-overlay').style.display !== 'none') {
                this.resizeCanvas();
            }
        });
    },

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.ctx = this.canvas.getContext('2d');
        this.ctx.strokeStyle = '#0f3868';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.drawImage(tempCanvas, 0, 0);
    },

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    },

    startDrawing(e) {
        if (e.cancelable) e.preventDefault();

        this.isDrawing = true;
        const pos = this.getPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    },

    draw(e) {
        if (!this.isDrawing) return;
        if (e.cancelable) e.preventDefault();

        const pos = this.getPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        if (!this.hasDrawn) {
            this.hasDrawn = true;
            document.getElementById('signature-placeholder').classList.add('hidden');
        }
    },

    stopDrawing() {
        this.isDrawing = false;
    },

    clear() {
        if (!this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasDrawn = false;

        const placeholder = document.getElementById('signature-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        // Resetar botões na tela principal
        const btnOpen = document.getElementById('btn-open-signature');
        if (btnOpen) {
            btnOpen.innerHTML = '<i data-lucide="pen-tool"></i> Coletar Assinatura do Colaborador *';
            btnOpen.style.borderColor = '#94a3b8';
            btnOpen.style.color = '#475569';
            if (window.lucide) window.lucide.createIcons();
        }

        const msg = document.getElementById('signature-status-msg');
        if (msg) msg.style.display = 'none';

        const confirmBtn = document.getElementById('btn-sig-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
        }
    },

    openOverlay() {
        // Apresentar overlay
        const overlay = document.getElementById('signature-overlay');
        overlay.style.display = 'flex';

        // Tentar travar em landscape se suportado por dispositivos mobile (fullscreen necessário em alguns)
        try {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => { });
            }
        } catch (e) { }

        // Timeout para garantir que o display 'flex' renderizou e obteve dimensões antes do resize
        setTimeout(() => {
            this.resizeCanvas();
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Redesenhar o traço se já houver
        }, 150);
    },

    closeOverlay() {
        document.getElementById('signature-overlay').style.display = 'none';
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (e) { }
    },

    doneSignature() {
        if (!this.hasDrawn) {
            SGE_ETL.helpers.toast('Por favor, colete a assinatura primeiro.', 'error');
            return;
        }

        // Sucesso na coleta
        this.closeOverlay();

        const msg = document.getElementById('signature-status-msg');
        if (msg) msg.style.display = 'block';

        const btnOpen = document.getElementById('btn-open-signature');
        if (btnOpen) {
            btnOpen.innerHTML = '<i data-lucide="pen-tool"></i> Refazer Assinatura';
            btnOpen.style.borderColor = '#16a34a'; // verde
            btnOpen.style.color = '#15803d';
            if (window.lucide) window.lucide.createIcons();
        }

        const confirmBtn = document.getElementById('btn-sig-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    },

    async confirm(payload) {
        if (!this.hasDrawn) {
            SGE_ETL.helpers.toast('A assinatura é obrigatória', 'error');
            return;
        }

        const btn = document.getElementById('btn-sig-confirm');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="rotating"></i> Salvando...';
        btn.disabled = true;

        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.5);

        const finalData = {
            id: `ETL-${Date.now()}`,
            data_hora: new Date().toISOString(),
            operador: SGE_ETL.state.plantao.operador,
            numeroSerie: SGE_ETL.state.plantao.aparelho,
            local: SGE_ETL.state.plantao.local,
            ...payload,
            assinatura: dataUrl
        };

        const res = await SGE_ETL.api.salvarEtilometria(finalData);

        btn.innerHTML = origText;
        btn.disabled = false;

        if (res.success) {
            SGE_ETL.helpers.toast('Teste Registrado com Sucesso!', 'success');
            if (SGE_ETL.state.testes_diario) {
                SGE_ETL.state.testes_diario.unshift({
                    id: finalData.id,
                    data_hora: finalData.data_hora,
                    operador: finalData.operador,
                    aparelho: finalData.numeroSerie,
                    local: finalData.local,
                    colaborador: finalData.nomeTestado,
                    cpf_mat: finalData.cpfMatricula,
                    funcao: finalData.postoFuncao,
                    resultado: finalData.resultado,
                    status: finalData.status,
                    assinatura: finalData.assinatura
                });
                SGE_ETL.helpers.updateStats();
            }

            this.clear(); // This will clear the canvas and UI buttons
            SGE_ETL.aplicacao.resetQueueForm(); // resets form fields
        } else {
            SGE_ETL.helpers.toast('Erro ao salvar. Verifique conexão.', 'error');
        }
    },

    bindEvents() {
        if (!this.canvas) return;

        // Touch
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.draw(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
        this.canvas.addEventListener('touchcancel', () => this.stopDrawing());

        // Mouse
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Modal Events
        const btnOpen = document.getElementById('btn-open-signature');
        if (btnOpen) btnOpen.addEventListener('click', () => this.openOverlay());

        const btnCancel = document.getElementById('btn-sig-cancel');
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeOverlay());

        const clrBtn = document.getElementById('btn-sig-clear');
        if (clrBtn) clrBtn.addEventListener('click', () => this.clear());

        const doneBtn = document.getElementById('btn-sig-done');
        if (doneBtn) doneBtn.addEventListener('click', () => this.doneSignature());
    }
};

document.addEventListener('DOMContentLoaded', () => SGE_ETL.signature.init());

