'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.helpers = {
    toast(msg, type = 'success') {
        const icons = {
            success: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2 8 6 12 14 4"/></svg>',
            error: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l12 12M14 2L2 14"/></svg>',
            info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11v1"/></svg>',
        };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = (icons[type] || '') + msg;
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(el);
            setTimeout(() => el.remove(), SGE_ETL.CONFIG.toastDuration);
        }
    },

    formatDate(isoString) {
        if (!isoString) return '—';
        try {
            const d = new Date(isoString);
            return d.toLocaleString('pt-BR');
        } catch (e) {
            return isoString;
        }
    },

    statusBadgeClass(status) {
        if (!status) return 'badge-SEM';
        const s = status.toUpperCase();
        if (s === 'NEGATIVO') return 'badge-16HS'; // Greenish
        if (s === 'ATENÇÃO') return 'badge-24D'; // Yellow/Orange
        if (s === 'POSITIVO') return 'badge-24A'; // Red
        return 'badge-SEM';
    },

    statusColor(status) {
        if (!status) return 'var(--slate-500)';
        const s = status.toUpperCase();
        if (s === 'NEGATIVO') return 'var(--success-text)';
        if (s === 'ATENÇÃO') return '#d97706';
        if (s === 'POSITIVO') return 'var(--danger-text)';
        return 'var(--slate-500)';
    },

    updateStats() {
        const testes = SGE_ETL.state.testes_diario ? Object.keys(SGE_ETL.state.testes_diario).length : 0;
        const statEl = document.getElementById('stat-testes');
        if (statEl) statEl.textContent = testes;
    }
};
