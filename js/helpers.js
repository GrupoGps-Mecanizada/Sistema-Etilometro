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
    },

    calcularTurno(dataFiltro, turma) {
        if (!dataFiltro || !turma) return 'F';
        // 1. Cria a data alvo com segurança de Fuso Horário
        const dataAlvo = new Date(`${dataFiltro}T12:00:00Z`);

        // ==========================================
        // LÓGICA DO TURNO ADMINISTRATIVO (ADM)
        // ==========================================
        if (turma.toUpperCase() === 'ADM') {
            const diaSemana = dataAlvo.getUTCDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
            if (diaSemana === 0 || diaSemana === 6) {
                return "F"; // Folga no fim de semana
            } else {
                return "ADM"; // Retorna 'ADM'
            }
        }

        // ==========================================
        // LÓGICA DO TURNO ININTERRUPTO (A, B, C, D) E SUAS VARIAÇÕES
        // ==========================================
        // Extrai a letra principal caso seja algo como "24HS-A" ou "A - 07 as 19"
        const t = turma.toUpperCase();
        let letra = null;
        if (t.includes('A')) letra = 'A';
        else if (t.includes('B')) letra = 'B';
        else if (t.includes('C')) letra = 'C';
        else if (t.includes('D')) letra = 'D';
        else return "F"; // Se não tem letra legível, assume folga

        const ciclo = ["07", "07", "19", "19", "F", "F", "F", "F"];
        const offsets = { 'A': 0, 'B': 4, 'C': 2, 'D': 6 };
        
        // Data base fixada: 2026-03-11 ao meio-dia (UTC)
        const dataBase = new Date("2026-03-11T12:00:00Z");
        
        const diffTempo = dataAlvo.getTime() - dataBase.getTime();
        const diffDias = Math.floor(diffTempo / (1000 * 3600 * 24));

        // A fórmula matemática pura para o loop contínuo
        const index = ((diffDias + offsets[letra]) % 8 + 8) % 8;
        
        return ciclo[index];
    }
};
