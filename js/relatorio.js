'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.relatorio = {
    _currentTab: 'testes',

    init() {
        this.cacheElements();
        this.bindEvents();
        // Set default date to today on the presença date picker
        const todayStr = new Date().toISOString().split('T')[0];
        if (this.els.presencaDate) this.els.presencaDate.value = todayStr;
        if (this.els.fDate) this.els.fDate.value = todayStr;
    },

    cacheElements() {
        this.els = {
            tbody:         document.getElementById('history-tbody'),
            emptyState:    document.getElementById('history-empty'),
            fDate:         document.getElementById('filter-date'),
            fName:         document.getElementById('filter-name'),
            fStatus:       document.getElementById('filter-status'),
            btnLoad:       document.getElementById('btn-load-testes'),
            btnExport:     document.getElementById('export-btn'),
            presencaDate:  document.getElementById('presenca-date'),
            btnLoadPres:   document.getElementById('btn-load-presenca'),
            btnExportPres: document.getElementById('btn-export-presenca'),
            presencaTbody: document.getElementById('presenca-tbody'),
            presencaEmpty: document.getElementById('presenca-empty'),
            presencaLoad:  document.getElementById('presenca-loading')
        };
    },

    bindEvents() {
        if (!this.els.tbody) return;
        // Text/status filters apply instantly to in-memory data
        [this.els.fName, this.els.fStatus].forEach(el => {
            if (el) { el.addEventListener('input', () => this.renderTestes()); el.addEventListener('change', () => this.renderTestes()); }
        });
        // Date change: load from DB
        this.els.fDate?.addEventListener('change', () => this.loadTestesByDate());
        this.els.btnLoad?.addEventListener('click', () => this.loadTestesByDate());
        this.els.btnExport?.addEventListener('click', () => this.exportCSVTestes());
        this.els.btnLoadPres?.addEventListener('click', () => this.loadPresenca());
        this.els.btnExportPres?.addEventListener('click', () => this.exportCSVPresenca());
    },

    switchTab(tab) {
        this._currentTab = tab;
        document.getElementById('painel-testes').style.display  = tab === 'testes'  ? 'block' : 'none';
        document.getElementById('painel-presenca').style.display = tab === 'presenca' ? 'block' : 'none';

        const tabTestes  = document.getElementById('tab-testes');
        const tabPres    = document.getElementById('tab-presenca');
        if (tabTestes) {
            tabTestes.style.color       = tab === 'testes' ? '#0f3868' : '#64748b';
            tabTestes.style.borderBottomColor = tab === 'testes' ? '#0f3868' : 'transparent';
            tabTestes.style.fontWeight  = tab === 'testes' ? '700' : '600';
        }
        if (tabPres) {
            tabPres.style.color       = tab === 'presenca' ? '#0f3868' : '#64748b';
            tabPres.style.borderBottomColor = tab === 'presenca' ? '#0f3868' : 'transparent';
            tabPres.style.fontWeight  = tab === 'presenca' ? '700' : '600';
        }
    },

    // ─── ABA TESTES ──────────────────────────────────────────────────────────

    async loadTestesByDate() {
        const dateStr = this.els.fDate?.value;
        if (!dateStr) { SGE_ETL.helpers.toast('Selecione uma data', 'error'); return; }

        if (this.els.btnLoad) { this.els.btnLoad.disabled = true; this.els.btnLoad.textContent = '...'; }
        if (this.els.tbody) this.els.tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#94a3b8;">Carregando...</td></tr>';

        const res = await SGE_ETL.api.loadTestesByDate(dateStr);

        if (this.els.btnLoad) { this.els.btnLoad.disabled = false; this.els.btnLoad.textContent = 'Carregar'; }

        if (!res.success) { SGE_ETL.helpers.toast('Erro: ' + res.error, 'error'); return; }

        // Store in state so filters also work
        SGE_ETL.state.testes_diario = res.data;
        SGE_ETL.helpers.updateStats();
        this.renderTestes();
    },

    renderTestes() {
        if (!this.els.tbody) return;
        const data = SGE_ETL.state.testes_diario || [];
        const vName   = (this.els.fName?.value || '').toLowerCase().trim();
        const vStatus = this.els.fStatus?.value || '';

        const filtered = data.filter(t => {
            if (vName   && t.colaborador && !t.colaborador.toLowerCase().includes(vName)) return false;
            if (vStatus && t.status !== vStatus) return false;
            return true;
        });

        // Keep backward-compat alias
        this.render = this.renderTestes;

        this.els.tbody.innerHTML = '';
        if (filtered.length === 0) { if (this.els.emptyState) this.els.emptyState.style.display = 'block'; return; }
        if (this.els.emptyState) this.els.emptyState.style.display = 'none';

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--slate-100)';
            tr.style.cursor = 'pointer';
            const color = SGE_ETL.helpers.statusColor(t.status);
            tr.innerHTML = `
                <td style="padding:12px 16px;">${SGE_ETL.helpers.formatDate(t.data_hora)}</td>
                <td style="padding:12px 16px; font-weight:500;">${t.colaborador || '—'}</td>
                <td style="padding:12px 16px;">${t.cpf_mat || '—'}</td>
                <td style="padding:12px 16px;">${t.aparelho || '—'}</td>
                <td style="padding:12px 16px; font-weight:700; color:${color};">${t.resultado}</td>
                <td style="padding:12px 16px;">
                    <span style="background:${color}20; color:${color}; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold; letter-spacing:0.5px;">${t.status}</span>
                </td>
                <td style="padding:12px 16px; color:var(--slate-500);">${t.operador}</td>`;
            tr.addEventListener('click', () => SGE_ETL.drawer.open(t));
            this.els.tbody.appendChild(tr);
        });
    },

    // ─── ABA PRESENÇA ────────────────────────────────────────────────────────

    async loadPresenca() {
        const dateStr = this.els.presencaDate?.value;
        if (!dateStr) { SGE_ETL.helpers.toast('Selecione uma data', 'error'); return; }
        if (!window.supabase) { SGE_ETL.helpers.toast('Supabase não inicializado', 'error'); return; }

        if (this.els.presencaLoad) this.els.presencaLoad.style.display = 'block';
        if (this.els.presencaEmpty) this.els.presencaEmpty.style.display = 'none';
        if (this.els.presencaTbody) this.els.presencaTbody.innerHTML = '';

        try {
            const dateStart = new Date(dateStr + 'T00:00:00Z').toISOString();
            const dateEnd   = new Date(dateStr + 'T23:59:59Z').toISOString();

            const [colabRes, testRes, ausRes] = await Promise.all([
                window.supabase.schema('gps_mec').from('efetivo_gps_mec_colaboradores')
                    .select('id, name, function, regime, category').eq('status', 'ATIVO').eq('category', 'OPERACIONAL').order('name'),
                window.supabase.schema('gps_mec').from('efetivo_gps_mec_etilometria')
                    .select('colaborador_id, colaborador_nome, resultado, status').gte('data_hora', dateStart).lte('data_hora', dateEnd),
                window.supabase.schema('gps_mec').from('efetivo_gps_mec_etilometria_ausencias')
                    .select('*').eq('date', dateStr)
            ]);

            if (colabRes.error) throw colabRes.error;
            if (testRes.error) throw testRes.error;
            if (ausRes.error) throw ausRes.error;

            const testedById = {};
            (testRes.data || []).forEach(t => { if (t.colaborador_id) testedById[t.colaborador_id] = t; });
            const testedByName = new Set((testRes.data || []).map(t => (t.colaborador_nome || '').trim().toUpperCase()));

            const ausenciaById = {};
            (ausRes.data || []).forEach(a => { if (a.colaborador_id) ausenciaById[a.colaborador_id] = a; });

            const rows = (colabRes.data || []).map(c => {
                const turno = c.regime ? SGE_ETL.helpers.calcularTurno(dateStr, c.regime) : null;
                if (turno === '19') return null; // excluir turno noturno

                const nomeMaius = (c.name || '').trim().toUpperCase();
                let status, testInfo = null, ausInfo = null;

                if (turno === 'F') {
                    status = 'FOLGA';
                } else if (testedById[c.id] || testedByName.has(nomeMaius)) {
                    status = 'PRESENTE';
                    testInfo = testedById[c.id] || null;
                } else if (ausenciaById[c.id]) {
                    status = 'AUSENTE';
                    ausInfo = ausenciaById[c.id];
                } else {
                    status = 'PENDENTE';
                }
                return { c, turno, status, testInfo, ausInfo };
            }).filter(Boolean);

            this._presencaData = rows;
            this._renderPresencaTable(rows);
        } catch (err) {
            SGE_ETL.helpers.toast('Erro ao carregar: ' + err.message, 'error');
        } finally {
            if (this.els.presencaLoad) this.els.presencaLoad.style.display = 'none';
        }
    },

    _renderPresencaTable(rows) {
        const tbody = this.els.presencaTbody;
        if (!tbody) return;
        if (!rows || rows.length === 0) {
            if (this.els.presencaEmpty) this.els.presencaEmpty.style.display = 'block';
            return;
        }
        if (this.els.presencaEmpty) this.els.presencaEmpty.style.display = 'none';

        const order = { PENDENTE: 0, AUSENTE: 1, PRESENTE: 2, FOLGA: 3 };
        rows.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

        const statusStyles = {
            PRESENTE: { bg: '#f0fdf4', color: '#15803d', label: 'PRESENTE' },
            PENDENTE: { bg: '#fffbeb', color: '#d97706', label: 'PENDENTE' },
            AUSENTE:  { bg: '#fef2f2', color: '#dc2626', label: 'AUSENTE' },
            FOLGA:    { bg: '#f5f3ff', color: '#7c3aed', label: 'FOLGA' }
        };

        const motivoMap = { FALTA: 'Falta', ATESTADO: 'Atestado', AFASTADO: 'Afastamento', SUBSTITUIDO: 'Substituído', TROCA_ESCALA: 'Troca de Escala', FERIAS: 'Férias', FOLGA: 'Folga Extra', OUTRO: 'Outro' };

        tbody.innerHTML = rows.map(({ c, turno, status, testInfo, ausInfo }) => {
            const st = statusStyles[status] || statusStyles.PENDENTE;
            const turnoLabel = turno === '07' ? '07h–19h' : turno === '19' ? '19h–07h' : turno === 'ADM' ? 'ADM' : turno || '—';
            const resultadoCell = testInfo ? `<span style="color:${SGE_ETL.helpers.statusColor(testInfo.status)};font-weight:700;">${parseFloat(testInfo.resultado).toFixed(2)} — ${testInfo.status}</span>` : '—';
            const motivoCell = ausInfo ? `${motivoMap[ausInfo.motivo] || ausInfo.motivo}${ausInfo.substituto_nome ? ' / ' + ausInfo.substituto_nome : ''}${ausInfo.observacoes ? ' — ' + ausInfo.observacoes : ''}` : '—';
            return `<tr style="background:${st.bg}; border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px 16px; font-weight:600;">${c.name}</td>
                <td style="padding:10px 16px; color:#6b7280;">${c.function || '—'}</td>
                <td style="padding:10px 16px; font-weight:600;">${c.regime || '—'}</td>
                <td style="padding:10px 16px; color:#6b7280;">${turnoLabel}</td>
                <td style="padding:10px 16px;"><span style="color:${st.color}; font-weight:700; font-size:12px;">${st.label}</span></td>
                <td style="padding:10px 16px;">${resultadoCell}</td>
                <td style="padding:10px 16px; color:#6b7280; font-size:12px;">${motivoCell}</td>
            </tr>`;
        }).join('');
    },

    exportCSVPresenca() {
        const rows = this._presencaData;
        if (!rows || rows.length === 0) { SGE_ETL.helpers.toast('Carregue os dados primeiro', 'error'); return; }
        const dateStr = this.els.presencaDate?.value || new Date().toISOString().split('T')[0];
        const motivoMap = { FALTA: 'Falta', ATESTADO: 'Atestado', AFASTADO: 'Afastamento', SUBSTITUIDO: 'Substituído', TROCA_ESCALA: 'Troca de Escala', FERIAS: 'Férias', FOLGA: 'Folga Extra', OUTRO: 'Outro' };

        const headers = ['Colaborador', 'Função', 'Turma', 'Turno', 'Presença', 'Resultado (mg/L)', 'Status Etilômetro', 'Motivo Ausência', 'Substituto', 'Observações'];
        const csvRows = rows.map(({ c, turno, status, testInfo, ausInfo }) => {
            const turnoLabel = turno === '07' ? '07h-19h' : turno === '19' ? '19h-07h' : turno || '';
            return [
                c.name,
                c.function || '',
                c.regime || '',
                turnoLabel,
                status,
                testInfo ? parseFloat(testInfo.resultado).toFixed(2) : '',
                testInfo ? testInfo.status : '',
                ausInfo ? (motivoMap[ausInfo.motivo] || ausInfo.motivo) : '',
                ausInfo?.substituto_nome || '',
                ausInfo?.observacoes || ''
            ];
        });
        let csv = headers.join(';') + '\n' + csvRows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Presenca_Etilometro_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    exportCSVTestes() {
        const data = SGE_ETL.state.testes_diario;
        if (!data || data.length === 0) { SGE_ETL.helpers.toast('Sem dados para exportar', 'error'); return; }
        const headers = ['Data/Hora', 'Colaborador', 'CPF/Mat', 'Função', 'Aparelho', 'Local', 'Operador', 'Resultado', 'Status', 'Observação'];
        const rows = data.map(t => [
            SGE_ETL.helpers.formatDate(t.data_hora), t.colaborador, t.cpf_mat, t.funcao,
            t.aparelho, t.local, t.operador, t.resultado, t.status, (t.observacoes || '').replace(/"/g,'""')
        ]);
        let csv = headers.join(';') + '\n' + rows.map(e => e.map(v => `"${v||''}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Relatorio_Etilometria_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // alias para compatibilidade com código legado que chama .render()
    render() { this.renderTestes(); },

    imprimirComprovante(data) {
        const printWindow = window.open('', '_blank');
        const color = SGE_ETL.helpers.statusColor(data.status);
        const sigHtml = data.assinatura && data.assinatura.length > 50
            ? `<img src="${data.assinatura}" style="max-height:80px;border-bottom:1px solid #000;padding-bottom:4px;margin-top:10px;" />`
            : `<div style="height:40px;border-bottom:1px solid #000;width:60%;margin:20px auto 10px auto;"></div><div style="font-size:10px;color:#666;">ASSINATURA COLABORADOR</div>`;
        const html = `<!DOCTYPE html><html><head><title>Comprovante de Etilometria</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#333;max-width:800px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid #0f3868;padding-bottom:20px;margin-bottom:30px}
        .title{font-size:24px;font-weight:bold;color:#0f3868;margin:0}.subtitle{font-size:14px;color:#666;margin-top:5px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
        .box{border:1px solid #ddd;padding:15px;border-radius:4px}.label{font-size:11px;text-transform:uppercase;color:#777;font-weight:bold;margin-bottom:4px}
        .value{font-size:14px;font-weight:bold}.big-result{text-align:center;padding:20px;background:#f9f9f9;border:2px solid ${color};border-radius:8px;margin-bottom:40px}
        .big-number{font-size:48px;font-weight:bold;color:${color}}.big-status{font-size:18px;font-weight:bold;color:${color};letter-spacing:2px;margin-top:10px}
        .sign-box{text-align:center;margin-top:60px}@media print{button{display:none}}</style></head>
        <body><button onclick="window.print()" style="padding:10px 20px;background:#0f3868;color:#fff;border:none;border-radius:4px;cursor:pointer;float:right;">Imprimir</button>
        <div class="header"><h1 class="title">COMPROVANTE DE ETILOMETRIA</h1><div class="subtitle">Log oficial de medição de taxa de alcoolemia</div></div>
        <div class="grid"><div class="box"><div class="label">Data e Hora</div><div class="value">${SGE_ETL.helpers.formatDate(data.data_hora)}</div></div>
        <div class="box"><div class="label">ID Sistema</div><div class="value">${data.id}</div></div></div>
        <div class="grid"><div class="box"><div class="label">Nome do Colaborador</div><div class="value" style="font-size:16px;">${data.colaborador}</div>
        <div style="margin-top:10px;"><span class="label">CPF/Matrícula:</span> <span class="value">${data.cpf_mat||'-'}</span>&nbsp;&nbsp;&nbsp;<span class="label">Função:</span> <span class="value">${data.funcao||'-'}</span></div></div>
        <div class="box"><div class="label">Operador do Equipamento</div><div class="value">${data.operador}</div>
        <div style="margin-top:10px;"><span class="label">Nº Série:</span> <span class="value">${data.aparelho}</span>&nbsp;&nbsp;&nbsp;<span class="label">Local:</span> <span class="value">${data.local}</span></div></div></div>
        <div class="big-result"><div class="label" style="margin-bottom:10px;">Resultado da Medição (mg/L)</div>
        <div class="big-number">${data.resultado}</div><div class="big-status">${data.status}</div></div>
        ${data.observacoes?`<div class="box"><div class="label">Observações</div><div class="value" style="font-weight:normal;">${data.observacoes}</div></div>`:''}
        <div class="sign-box">${sigHtml}</div>
        <div style="margin-top:60px;font-size:10px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:10px;">SGE Etilometria Digital</div>
        </body></html>`;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }
};
