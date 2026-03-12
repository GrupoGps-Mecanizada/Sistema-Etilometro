'use strict';

window.SGE_ETL = window.SGE_ETL || {};

/**
 * SGE_ETL API
 * Uses window.supabase (same pattern as Gestão Efetivo).
 * Column names mirror the real DB schema:
 *   efetivo_gps_mec_colaboradores → id, name, function, regime, matricula_gps, telefone, status
 *   efetivo_gps_mec_etilometria   → id, data_hora, operador_nome, aparelho_serie, local_teste,
 *                                    colaborador_id, colaborador_nome, colaborador_cpf_mat,
 *                                    colaborador_funcao, resultado, status, observacoes, assinatura
 */
SGE_ETL.api = {

    async loadDiario() {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria')
                .select('*')
                .gte('data_hora', today.toISOString())
                .order('data_hora', { ascending: false });

            if (error) throw error;

            const mapped = data.map(d => ({
                id: d.id,
                data_hora: d.data_hora,
                operador: d.operador_nome,
                aparelho: d.aparelho_serie,
                local: d.local_teste,
                colaborador: d.colaborador_nome,
                cpf_mat: d.colaborador_cpf_mat,
                funcao: d.colaborador_funcao,
                resultado: d.resultado,
                status: d.status,
                observacoes: d.observacoes,
                assinatura: d.assinatura
            }));

            SGE_ETL.state.testes_diario = mapped;
            return { success: true, data: mapped };
        } catch (e) {
            console.error('API loadDiario Error:', e);
            return { success: false, error: e.message };
        }
    },

    async fetchColaboradores() {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };

        try {
            // Real column names: name, function, regime, matricula_gps, status
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_colaboradores')
                .select('id, name, function, regime, matricula_gps, telefone, status')
                .neq('status', 'DESLIGADO')
                .order('name');

            if (error) throw error;

            // Normalize field names so the rest of the frontend can use .nome and .funcao
            const normalized = data.map(c => ({
                id: c.id,
                nome: c.name,
                funcao: c.function,
                regime: c.regime,
                matricula_gps: c.matricula_gps,
                telefone: c.telefone,
                status: c.status
            }));

            return { success: true, data: normalized };
        } catch (e) {
            console.error('API fetchColaboradores Error:', e);
            return { success: false, error: e.message };
        }
    },

    async salvarEtilometria(payload) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };

        try {
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria')
                .insert([{
                    data_hora: payload.data_hora,
                    operador_nome: payload.operador,
                    aparelho_serie: payload.numeroSerie,
                    local_teste: payload.local,
                    colaborador_id: payload.colaborador_id || null,
                    colaborador_nome: payload.nomeTestado,
                    colaborador_cpf_mat: payload.cpfMatricula,
                    colaborador_funcao: payload.postoFuncao,
                    resultado: parseFloat(payload.resultado) || 0,
                    status: payload.status,
                    observacoes: payload.observacoes || null,
                    assinatura: payload.assinatura || null
                }])
                .select('id')
                .single();

            if (error) throw error;
            return { success: true, id: data.id };
        } catch (e) {
            console.error('API salvarEtilometria Error:', e);
            return { success: false, error: e.message };
        }
    }
};
