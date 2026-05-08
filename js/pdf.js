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
    },

    // ── Relatório de Justificativas + Pendentes ──────────────────────────────
    exportarRelatorioJustificativas(colaboradores, records, meta) {
        if (!window.jspdf?.jsPDF) {
            SGE_ETL.helpers.toast('Biblioteca PDF nao carregada. Recarregue a pagina.', 'error');
            return;
        }

        const STATUS_LABELS = {
            'F':  'Falta',
            'FE': 'Ferias',
            'FO': 'Folga',
            'TR': 'Treinamento',
            'AT': 'Atestado',
            'AF': 'Afastado',
            'TH': 'Troca Horario',
            'TE': 'Troca Escala',
            'EX': 'Extra'
        };

        const { jsPDF } = window.jspdf;
        const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW  = doc.internal.pageSize.getWidth();
        const margin = 14;

        const dateLabel = meta.data
            ? new Date(meta.data + 'T12:00:00').toLocaleDateString('pt-BR')
            : new Date().toLocaleDateString('pt-BR');

        // ── Cabeçalho ────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 56, 104);
        doc.text('GRUPO GPS MECANIZADA', margin, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text('RELATORIO DE JUSTIFICATIVAS E PENDENCIAS', margin, 24);
        doc.text(`Data: ${dateLabel}   Operador: ${meta.operador || '—'}`, margin, 30);

        doc.setDrawColor(15, 56, 104);
        doc.setLineWidth(0.5);
        doc.line(margin, 33, pageW - margin, 33);

        // ── Separar justificadas vs pendentes ────────────────────────
        const justRows = [];
        const pendRows = [];

        colaboradores.forEach(c => {
            const rec = records[c.id];
            if (c.isFolga || c.isPresente) return; // folga do sistema e presentes nao entram

            if (rec) {
                const statusLabel = STATUS_LABELS[rec.status] || rec.status;
                const e = rec.extras || {};
                const detalhes = [
                    e.has_justification === true  ? 'Justificativa: Sim'  : e.has_justification === false ? 'Justificativa: Nao' : '',
                    e.replacement_employee_name   ? 'Substituto: ' + e.replacement_employee_name : '',
                    e.training_type               ? 'Treino: ' + e.training_type : '',
                    e.new_schedule                ? 'Horario: ' + e.new_schedule : '',
                    e.scale_change_target         ? 'Escala: ' + e.scale_change_target + (e.scale_change_date ? ' (' + e.scale_change_date + ')' : '') : '',
                    e.observations                ? 'Obs: ' + e.observations : ''
                ].filter(Boolean).join('\n');

                justRows.push([c.name, c.funcao || '—', c.regime || '—', statusLabel, detalhes || '—']);
            } else {
                pendRows.push([c.name, c.funcao || '—', c.regime || '—']);
            }
        });

        let curY = 36;

        // ── Seção 1: Justificativas ───────────────────────────────────
        this._sectionTitle(doc, 'JUSTIFICATIVAS', justRows.length, margin, curY, [15, 56, 104]);
        curY += 8;

        if (justRows.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('Nenhuma justificativa registrada.', margin, curY + 4);
            curY += 12;
        } else {
            doc.autoTable({
                startY: curY,
                head: [['Nome', 'Funcao', 'Turma', 'Status', 'Detalhes']],
                body: justRows,
                margin: { left: margin, right: margin },
                columnStyles: {
                    0: { cellWidth: 55 },
                    1: { cellWidth: 38 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 28 },
                    4: { cellWidth: 45 }
                },
                styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
                headStyles: { fillColor: [15, 56, 104], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                rowPageBreak: 'avoid'
            });
            curY = doc.lastAutoTable.finalY + 10;
        }

        // ── Seção 2: Pendentes ────────────────────────────────────────
        this._sectionTitle(doc, 'PENDENTES', pendRows.length, margin, curY, [185, 28, 28]);
        curY += 8;

        if (pendRows.length === 0) {
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('Nenhum colaborador pendente.', margin, curY + 4);
            curY += 12;
        } else {
            doc.autoTable({
                startY: curY,
                head: [['Nome', 'Funcao', 'Turma']],
                body: pendRows,
                margin: { left: margin, right: margin },
                columnStyles: {
                    0: { cellWidth: 100 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 22 }
                },
                styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
                headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                alternateRowStyles: { fillColor: [255, 250, 250] },
                rowPageBreak: 'avoid'
            });
        }

        // ── Rodapé ────────────────────────────────────────────────────
        const pageCount = doc.internal.getNumberOfPages();
        const genAt = new Date().toLocaleString('pt-BR');

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const ph = doc.internal.pageSize.getHeight();
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            if (i === pageCount) {
                doc.text(
                    `Justificativas: ${justRows.length}  |  Pendentes: ${pendRows.length}  |  Total diurno: ${colaboradores.filter(c => !c.isFolga && !c.isPresente).length}`,
                    margin, ph - 10
                );
            }
            doc.text(`Gerado em: ${genAt}`, margin, ph - 5);
            doc.text(`Pag. ${i} de ${pageCount}`, pageW - margin, ph - 5, { align: 'right' });
        }

        // ── Salvar ────────────────────────────────────────────────────
        const dataStr = meta.data || new Date().toISOString().split('T')[0];
        doc.save(`Justificativas_${dataStr}.pdf`);
        SGE_ETL.helpers.toast('Relatorio exportado com sucesso', 'success');
    },

    _sectionTitle(doc, title, count, x, y, color) {
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 14;
        doc.setFillColor(...color);
        doc.roundedRect(x, y, pageW - margin * 2, 7, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${title}  (${count})`, x + 3, y + 5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
    }
};
