'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.api = {
    async doReq(url, method, params = null) {
        if (!url || !navigator.onLine) {
            return { success: false, error: 'Offline ou URL não configurada' };
        }

        try {
            if (method === 'GET') {
                const query = new URLSearchParams({
                    action: params.action || '',
                    ...params
                }).toString();
                const res = await fetch(`${url}?${query}`);
                if (!res.ok) throw new Error('Erro na rede HTTP');
                return await res.json();
            } else {
                // POST requests to Google Apps Script need no-cors and JSON.stringify
                await fetch(url, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(params)
                });
                // Apps Script with no-cors doesn't return readable JSON. 
                // We assume success if it didn't throw.
                return { success: true };
            }
        } catch (e) {
            console.error('API Error:', e);
            return { success: false, error: e.message };
        }
    },

    async loadDiario() {
        const url = SGE_ETL.CONFIG.gasUrl;
        const res = await this.doReq(url, 'GET', { action: 'listar_diario' });
        if (res.success && res.data) {
            SGE_ETL.state.testes_diario = res.data;
        }
        return res;
    },

    async fetchColaboradores() {
        const url = SGE_ETL.CONFIG.efetivoUrl;
        if (!url) return { success: false, error: 'URL do Efetivo não configurada' };
        return await this.doReq(url, 'GET', { action: 'listar_colaboradores' });
    },

    async searchEtilometria(query) {
        const url = SGE_ETL.CONFIG.gasUrl;
        return await this.doReq(url, 'GET', { action: 'pesquisar_etilometria', query });
    },

    async salvarEtilometria(payload) {
        const url = SGE_ETL.CONFIG.gasUrl;
        const finalPayload = {
            action: 'salvar_etilometria',
            params: payload
        };
        // It's a fire and forget approach with no-cors
        return await this.doReq(url, 'POST', finalPayload);
    }
};
