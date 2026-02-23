'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.relatorio = {
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        this.els = {
            tbody: document.getElementById('history-tbody'),
            emptyState: document.getElementById('history-empty'),
            fDate: document.getElementById('filter-date'),
            fName: document.getElementById('filter-name'),
            fStatus: document.getElementById('filter-status'),
            btnExport: document.getElementById('export-btn')
        };
    },

    bindEvents() {
        if (!this.els.tbody) return;

        [this.els.fDate, this.els.fName, this.els.fStatus].forEach(el => {
            el.addEventListener('input', () => this.render());
            el.addEventListener('change', () => this.render());
        });

        this.els.btnExport.addEventListener('click', () => {
            this.exportCSV();
        });
    },

    render() {
        if (!this.els.tbody) return;

        const data = SGE_ETL.state.testes_diario || [];

        // Apply Filters
        const vDate = this.els.fDate.value;
        const vName = this.els.fName.value.toLowerCase().trim();
        const vStatus = this.els.fStatus.value;

        const filtered = data.filter(t => {
            if (vDate && !t.data_hora.includes(vDate)) return false;
            if (vName && t.colaborador && !t.colaborador.toLowerCase().includes(vName)) return false;
            if (vStatus && t.status !== vStatus) return false;
            return true;
        });

        this.els.tbody.innerHTML = '';

        if (filtered.length === 0) {
            this.els.emptyState.style.display = 'block';
            return;
        }

        this.els.emptyState.style.display = 'none';

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--slate-100)';
            tr.style.cursor = 'pointer';
            tr.className = 'hover:bg-slate-50 transition-colors';

            const color = SGE_ETL.helpers.statusColor(t.status);

            tr.innerHTML = `
                <td style="padding: 12px 16px;">${SGE_ETL.helpers.formatDate(t.data_hora)}</td>
                <td style="padding: 12px 16px; font-weight: 500;">${t.colaborador || '-'}</td>
                <td style="padding: 12px 16px;">${t.cpf_mat || '-'}</td>
                <td style="padding: 12px 16px;">${t.aparelho || '-'}</td>
                <td style="padding: 12px 16px; font-weight: 700; color: ${color};">${t.resultado}</td>
                <td style="padding: 12px 16px;">
                    <span style="background: ${color}20; color: ${color}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">${t.status}</span>
                </td>
                <td style="padding: 12px 16px; color: var(--slate-500);">${t.operador}</td>
            `;

            tr.addEventListener('click', () => {
                SGE_ETL.drawer.open(t);
            });

            this.els.tbody.appendChild(tr);
        });
    },

    exportCSV() {
        const data = SGE_ETL.state.testes_diario;
        if (!data || data.length === 0) {
            SGE_ETL.helpers.toast('Sem dados para exportar', 'error');
            return;
        }

        const headers = ['Data/Hora', 'Colaborador', 'CPF/Mat', 'Funcão', 'Aparelho', 'Local', 'Operador', 'Resultado', 'Status', 'Observação'];

        const rows = data.map(t => [
            SGE_ETL.helpers.formatDate(t.data_hora),
            t.colaborador,
            t.cpf_mat,
            t.funcao,
            t.aparelho,
            t.local,
            t.operador,
            t.resultado,
            t.status,
            (t.observacoes || '').replace(/"/g, '""')
        ]);

        let csvContent = headers.join(';') + '\n' + rows.map(e => e.map(item => `"${item || ''}"`).join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Etilometria_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    imprimirComprovante(data) {
        const printWindow = window.open('', '_blank');
        const color = SGE_ETL.helpers.statusColor(data.status);

        const sigHtml = data.assinatura && data.assinatura.length > 50
            ? `<img src="${data.assinatura}" style="max-height: 80px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-top: 10px;" />`
            : `<div style="height: 40px; border-bottom: 1px solid #000; width: 60%; margin: 20px auto 10px auto;"></div><div style="font-size: 10px; color: #666;">ASSINATURA COLABORADOR</div>`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Comprovante de Etilometria</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #0f3868; padding-bottom: 20px; margin-bottom: 30px; }
                    .title { font-size: 24px; font-weight: bold; color: #0f3868; margin: 0; }
                    .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
                    .label { font-size: 11px; text-transform: uppercase; color: #777; font-weight: bold; margin-bottom: 4px; }
                    .value { font-size: 14px; font-weight: bold; }
                    .big-result { text-align: center; padding: 20px; background: #f9f9f9; border: 2px solid ${color}; border-radius: 8px; margin-bottom: 40px; }
                    .big-number { font-size: 48px; font-weight: bold; color: ${color}; }
                    .big-status { font-size: 18px; font-weight: bold; color: ${color}; letter-spacing: 2px; margin-top: 10px; }
                    .sign-box { text-align: center; margin-top: 60px; }
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <button onclick="window.print()" style="padding: 10px 20px; background: #0f3868; color: #fff; border:none; border-radius: 4px; cursor: pointer; float: right;">Imprimir</button>
                
                <div class="header">
                    <h1 class="title">COMPROVANTE DE ETILOMETRIA</h1>
                    <div class="subtitle">Log oficial de medição de taxa de alcoolemia</div>
                </div>

                <div class="grid">
                    <div class="box">
                        <div class="label">Data e Hora</div>
                        <div class="value">${SGE_ETL.helpers.formatDate(data.data_hora)}</div>
                    </div>
                    <div class="box">
                        <div class="label">ID Sistema</div>
                        <div class="value">${data.id}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="box">
                        <div class="label">Nome do Colaborador</div>
                        <div class="value" style="font-size: 16px;">${data.colaborador}</div>
                        <div style="margin-top:10px;">
                            <span class="label">CPF/Matrícula:</span> <span class="value">${data.cpf_mat || '-'}</span>
                             &nbsp;&nbsp;&nbsp; 
                            <span class="label">Função/Cargo:</span> <span class="value">${data.funcao || '-'}</span>
                        </div>
                    </div>
                    <div class="box">
                        <div class="label">Operador do Equipamento</div>
                        <div class="value">${data.operador}</div>
                        <div style="margin-top:10px;">
                            <span class="label">Nº Série Aparelho:</span> <span class="value">${data.aparelho}</span>
                             &nbsp;&nbsp;&nbsp; 
                            <span class="label">Local:</span> <span class="value">${data.local}</span>
                        </div>
                    </div>
                </div>

                <div class="big-result">
                    <div class="label" style="margin-bottom: 10px;">Resultado da Medição (mg/L)</div>
                    <div class="big-number">${data.resultado}</div>
                    <div class="big-status">${data.status}</div>
                </div>

                ${data.observacoes ? `
                <div class="box">
                    <div class="label">Observações sobre o Teste</div>
                    <div class="value" style="font-weight: normal;">${data.observacoes}</div>
                </div>
                ` : ''}

                <div class="sign-box">
                    ${sigHtml}
                </div>
                
                <div style="margin-top: 60px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
                    Este documento é um comprovante digital gerado pelo sistema SGE Etilometria.
                </div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }
};
