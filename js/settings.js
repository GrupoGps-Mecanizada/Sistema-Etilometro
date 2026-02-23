'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.settings = {
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        this.els = {
            inUrl: document.getElementById('config-url'),
            inEfetivo: document.getElementById('config-efetivo-url'),
            btnSave: document.getElementById('btn-save-settings'),
            btnClear: document.getElementById('btn-clear-cache')
        };
    },

    render() {
        if (this.els.inUrl) {
            this.els.inUrl.value = window.SGE_ETL.CONFIG.gasUrl || '';
            this.els.inEfetivo.value = window.SGE_ETL.CONFIG.efetivoUrl || '';
        }
    },

    bindEvents() {
        if (!this.els.btnSave) return;

        this.els.btnSave.addEventListener('click', () => {
            const url = this.els.inUrl.value.trim();
            const eUrl = this.els.inEfetivo.value.trim();

            localStorage.setItem('SGE_ETL_URL', url);
            localStorage.setItem('SGE_ETL_EFETIVO_URL', eUrl);

            SGE_ETL.CONFIG.gasUrl = url;
            SGE_ETL.CONFIG.efetivoUrl = eUrl;

            SGE_ETL.helpers.toast('Configurações Salvas com Sucesso');
        });

        this.els.btnClear.addEventListener('click', () => {
            if (confirm("Isto limpará o usuário atual e configurações de URL. Deseja continuar?")) {
                localStorage.removeItem('SGE_ETL_USER');
                localStorage.removeItem('SGE_ETL_URL');
                localStorage.removeItem('SGE_ETL_EFETIVO_URL');
                SGE_ETL.helpers.toast('Cache e Configurações Limpos');
                setTimeout(() => location.reload(), 1000);
            }
        });
    }
};
