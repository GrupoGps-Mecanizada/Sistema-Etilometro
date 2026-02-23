'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.dashboard = {
    chartVolume: null,
    chartStatus: null,

    init() {
        // Prepare layout/colors
    },

    render() {
        const data = SGE_ETL.state.testes_diario || [];

        let neg = 0, att = 0, pos = 0;

        data.forEach(t => {
            if (t.status === 'NEGATIVO') neg++;
            if (t.status === 'ATENÇÃO') att++;
            if (t.status === 'POSITIVO') pos++;
        });

        document.getElementById('kpi-testes-hoje').textContent = data.length;
        document.getElementById('kpi-casos-atencao').textContent = att;
        document.getElementById('kpi-casos-positivo').textContent = pos;

        this.renderStatusChart(neg, att, pos);
        this.renderVolumeChart(data);
    },

    renderStatusChart(neg, att, pos) {
        const ctx = document.getElementById('chart-status');
        if (!ctx) return;

        if (this.chartStatus) this.chartStatus.destroy();

        if (typeof Chart === 'undefined') return;

        this.chartStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Negativo', 'Atenção', 'Positivo'],
                datasets: [{
                    data: [neg, att, pos],
                    backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    renderVolumeChart(data) {
        const ctx = document.getElementById('chart-volume');
        if (!ctx) return;

        if (this.chartVolume) this.chartVolume.destroy();

        if (typeof Chart === 'undefined') return;

        // Group by hour for today since data is mostly 'diario'
        const hours = new Array(24).fill(0);
        data.forEach(t => {
            try {
                const hour = new Date(t.data_hora).getHours();
                if (!isNaN(hour)) {
                    hours[hour]++;
                }
            } catch (e) { }
        });

        // Filter out empty ends to make it look nicer, or just 6 to 20 window
        const labels = [];
        const plotData = [];
        for (let i = 0; i < 24; i++) {
            if (i >= 5 && i <= 23) { // Typically active hours
                labels.push(`${i}h`);
                plotData.push(hours[i]);
            }
        }

        this.chartVolume = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Testes Realizados',
                    data: plotData,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, suggestedMax: 10 }
                }
            }
        });
    }
};
