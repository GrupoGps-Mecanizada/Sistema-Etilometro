'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.drawer = {
    open(testeData) {
        SGE_ETL.state.drawerTeste = testeData;

        document.getElementById('drawer-title').textContent = testeData.colaborador || 'Sem Nome';
        document.getElementById('drawer-id').textContent = testeData.id || 'ID: —';

        const body = document.getElementById('drawer-body');

        let signatureHtml = '';
        if (testeData.assinatura && testeData.assinatura.length > 50) {
            signatureHtml = `<img src="${testeData.assinatura}" alt="Assinatura" style="max-width:100%; border: 1px solid var(--border); border-radius: 4px; background: #fff;" />`;
        } else {
            signatureHtml = `<div style="padding: 1rem; text-align:center; background:var(--bg-3); border-radius:4px; font-size:12px; color:var(--text-3)">Sem assinatura registrada</div>`;
        }

        body.innerHTML = `
            <div style="margin-bottom: 24px;">
                <label style="font-size: 10px; color: var(--text-3); text-transform: uppercase; font-weight: 600;">Data e Hora do Teste</label>
                <div style="font-weight: 500; color: var(--text-1);">${SGE_ETL.helpers.formatDate(testeData.data_hora)}</div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <label style="font-size: 10px; color: var(--text-3); text-transform: uppercase; font-weight: 600;">Aparelho e Local</label>
                <div style="font-weight: 500; color: var(--text-1);">${testeData.aparelho} • ${testeData.local}</div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="font-size: 10px; color: var(--text-3); text-transform: uppercase; font-weight: 600;">Operador</label>
                <div style="font-weight: 500; color: var(--text-1);">${testeData.operador}</div>
            </div>
            
            <div style="padding: 16px; background: ${SGE_ETL.helpers.statusColor(testeData.status)}20; border-radius: 8px; margin-bottom: 24px;">
                 <label style="font-size: 11px; color: ${SGE_ETL.helpers.statusColor(testeData.status)}; text-transform: uppercase; font-weight: 700; display:block; text-align:center; margin-bottom: 8px;">Medição Final</label>
                 <div style="font-weight: 800; color: ${SGE_ETL.helpers.statusColor(testeData.status)}; font-size: 2rem; text-align: center;">${testeData.resultado} <span style="font-size: 14px">mg/L</span></div>
                 <div style="text-align:center; font-weight: bold; font-size: 1.2rem; color: ${SGE_ETL.helpers.statusColor(testeData.status)}; margin-top:4px;">${testeData.status}</div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="font-size: 10px; color: var(--text-3); text-transform: uppercase; font-weight: 600; display:block; margin-bottom:8px;">Assinatura do Testado</label>
                ${signatureHtml}
            </div>
            
            ${testeData.observacoes ? `
                <div style="margin-bottom: 24px; padding: 12px; background: var(--bg-3); border-radius: 4px; font-size: 13px;">
                    <strong style="display:block; margin-bottom: 4px; font-size: 11px;">Observação:</strong>
                    ${testeData.observacoes}
                </div>
            ` : ''}
        `;

        const btnPrint = document.querySelector('.drawer-btn[data-action="print"]');
        if (btnPrint) {
            // Need to remove old listeners to prevent multiple clicks
            const newBtn = btnPrint.cloneNode(true);
            btnPrint.parentNode.replaceChild(newBtn, btnPrint);
            newBtn.addEventListener('click', () => {
                SGE_ETL.relatorio.imprimirComprovante(testeData);
            });
        }

        document.getElementById('drawer-overlay').classList.add('open');
        document.getElementById('drawer').classList.add('open');
    },

    close() {
        SGE_ETL.state.drawerTeste = null;
        document.getElementById('drawer').classList.remove('open');
        document.getElementById('drawer-overlay').classList.remove('open');
    }
};
