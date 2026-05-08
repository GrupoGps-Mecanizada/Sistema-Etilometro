'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.pdf = {

    exportarListaComAssinaturas(testes, meta) {
        if (!window.jspdf?.jsPDF) {
            SGE_ETL.helpers.toast('Biblioteca PDF nao carregada. Recarregue a pagina.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 14;

        // ── Cabeçalho ──────────────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 56, 104);
        doc.text('GRUPO GPS MECANIZADA', margin, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text('ETILOMETRIA DIGITAL — LISTA COM ASSINATURAS', margin, 24);

        const dateLabel = meta.data
            ? new Date(meta.data + 'T12:00:00').toLocaleDateString('pt-BR')
            : new Date().toLocaleDateString('pt-BR');

        doc.text(
            `Data: ${dateLabel}   Operador: ${meta.operador || '—'}   Local: ${meta.local || '—'}`,
            margin, 30
        );

        doc.setDrawColor(15, 56, 104);
        doc.setLineWidth(0.5);
        doc.line(margin, 33, pageW - margin, 33);

        // ── Dados da tabela ─────────────────────────────────────────
        const signatureMap = {};
        const rows = testes.map((t, i) => {
            if (t.assinatura && t.assinatura.length > 50) signatureMap[i] = t.assinatura;
            return [
                t.colaborador || '—',
                t.funcao      || '—',
                parseFloat(t.resultado || 0).toFixed(2) + ' mg/L',
                t.status      || '—',
                ''
            ];
        });

        // ── Tabela com autoTable ────────────────────────────────────
        doc.autoTable({
            startY: 36,
            head: [['Nome', 'Funcao', 'Resultado', 'Status', 'Assinatura']],
            body: rows,
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 58 },
                1: { cellWidth: 32 },
                2: { cellWidth: 22 },
                3: { cellWidth: 26 },
                4: { cellWidth: 44 }
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                minCellHeight: 18,
                overflow: 'linebreak',
                font: 'helvetica'
            },
            headStyles: {
                fillColor: [15, 56, 104],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 9
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            rowPageBreak: 'avoid',
            didDrawCell: (data) => {
                if (data.column.index !== 4 || data.cell.section !== 'body') return;

                const sig = signatureMap[data.row.index];
                if (sig) {
                    const format = sig.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
                    const x = data.cell.x + 2;
                    const y = data.cell.y + 2;
                    const w = data.cell.width - 4;
                    const h = data.cell.height - 4;
                    try {
                        doc.addImage(sig, format, x, y, w, h);
                    } catch (_) {
                        // imagem corrompida — deixar célula vazia
                    }
                } else {
                    // linha tracejada para assinatura ausente
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineDashPattern([2, 2], 0);
                    const midY = data.cell.y + data.cell.height / 2;
                    doc.line(
                        data.cell.x + 4, midY,
                        data.cell.x + data.cell.width - 4, midY
                    );
                    doc.setLineDashPattern([], 0);
                    doc.setDrawColor(0);
                }
            }
        });

        // ── Rodapé com totais ───────────────────────────────────────
        const neg = testes.filter(t => t.status === 'NEGATIVO').length;
        const att = testes.filter(t => t.status === 'ATENCAO' || t.status === 'ATENÇÃO').length;
        const pos = testes.filter(t => t.status === 'POSITIVO').length;

        const pageCount = doc.internal.getNumberOfPages();
        const genAt = new Date().toLocaleString('pt-BR');

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const ph = doc.internal.pageSize.getHeight();

            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);

            if (i === pageCount) {
                doc.text(
                    `Total: ${testes.length}  |  Negativos: ${neg}  |  Atencao: ${att}  |  Positivos: ${pos}`,
                    margin, ph - 10
                );
            }

            doc.text(`Gerado em: ${genAt}`, margin, ph - 5);
            doc.text(`Pag. ${i} de ${pageCount}`, pageW - margin, ph - 5, { align: 'right' });
        }

        // ── Salvar ──────────────────────────────────────────────────
        const dataStr = meta.data || new Date().toISOString().split('T')[0];
        doc.save(`Etilometria_Assinaturas_${dataStr}.pdf`);
        SGE_ETL.helpers.toast('PDF gerado com sucesso', 'success');
    }
};
