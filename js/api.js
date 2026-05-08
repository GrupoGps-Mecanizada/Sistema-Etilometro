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
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_colaboradores')
                .select('id, name, function, regime, matricula_gps, telefone, status, supervisor_id')
                .neq('status', 'DESLIGADO')
                .order('name');

            if (error) throw error;

            const normalized = data.map(c => ({
                id: c.id,
                nome: c.name,
                funcao: c.function,
                regime: c.regime,
                matricula_gps: c.matricula_gps,
                telefone: c.telefone,
                status: c.status,
                supervisor_id: c.supervisor_id
            }));

            return { success: true, data: normalized };
        } catch (e) {
            console.error('API fetchColaboradores Error:', e);
            return { success: false, error: e.message };
        }
    },

    async savePresencaRegistros(rows) {
        if (!window.supabase || !rows.length) return { success: false, error: 'Sem dados' };
        try {
            const { error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_registros_presenca')
                .upsert(rows, { onConflict: 'employee_id,date' });
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.error('API savePresencaRegistros Error:', e);
            return { success: false, error: e.message };
        }
    },

    async loadAusencias(dateStr) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };
        try {
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria_ausencias')
                .select('*')
                .eq('date', dateStr);
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (e) {
            console.error('API loadAusencias Error:', e);
            return { success: false, error: e.message };
        }
    },

    async saveAusencia(payload) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };
        try {
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria_ausencias')
                .upsert([{
                    date: payload.date,
                    colaborador_id: payload.colaborador_id || null,
                    colaborador_nome: payload.colaborador_nome,
                    colaborador_funcao: payload.colaborador_funcao || null,
                    colaborador_regime: payload.colaborador_regime || null,
                    motivo: payload.motivo,
                    observacoes: payload.observacoes || null,
                    substituto_nome: payload.substituto_nome || null,
                    operador_nome: payload.operador_nome
                }], { onConflict: 'colaborador_id,date' })
                .select('id')
                .single();
            if (error) throw error;
            return { success: true, id: data.id };
        } catch (e) {
            console.error('API saveAusencia Error:', e);
            return { success: false, error: e.message };
        }
    },

    async deleteAusencia(colaboradorId, dateStr) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };
        try {
            const { error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria_ausencias')
                .delete()
                .eq('colaborador_id', colaboradorId)
                .eq('date', dateStr);
            if (error) throw error;
            return { success: true };
        } catch (e) {
            console.error('API deleteAusencia Error:', e);
            return { success: false, error: e.message };
        }
    },

    async loadTestesByDate(dateStr) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };
        try {
            const start = new Date(dateStr + 'T00:00:00Z').toISOString();
            const end   = new Date(dateStr + 'T23:59:59Z').toISOString();
            const { data, error } = await window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria')
                .select('*')
                .gte('data_hora', start)
                .lte('data_hora', end)
                .order('data_hora', { ascending: false });
            if (error) throw error;
            return { success: true, data: data.map(d => ({
                id: d.id, data_hora: d.data_hora, operador: d.operador_nome, aparelho: d.aparelho_serie,
                local: d.local_teste, colaborador: d.colaborador_nome, cpf_mat: d.colaborador_cpf_mat,
                funcao: d.colaborador_funcao, resultado: d.resultado, status: d.status,
                observacoes: d.observacoes, assinatura: d.assinatura
            })) };
        } catch (e) {
            console.error('API loadTestesByDate Error:', e);
            return { success: false, error: e.message };
        }
    },

    async searchEtilometria(query, dateStr) {
        if (!window.supabase) return { success: false, error: 'Supabase não inicializado' };
        try {
            let req = window.supabase
                .schema('gps_mec')
                .from('efetivo_gps_mec_etilometria')
                .select('*')
                .or(`colaborador_nome.ilike.%${query}%,colaborador_cpf_mat.ilike.%${query}%`)
                .order('data_hora', { ascending: false })
                .limit(80);
            if (dateStr) {
                req = req
                    .gte('data_hora', new Date(dateStr + 'T00:00:00Z').toISOString())
                    .lte('data_hora', new Date(dateStr + 'T23:59:59Z').toISOString());
            }
            const { data, error } = await req;
            if (error) throw error;
            return { success: true, data: data.map(d => ({
                id: d.id, data_hora: d.data_hora, operador: d.operador_nome, aparelho: d.aparelho_serie,
                local: d.local_teste, colaborador: d.colaborador_nome, cpf_mat: d.colaborador_cpf_mat,
                funcao: d.colaborador_funcao, resultado: d.resultado, status: d.status,
                observacoes: d.observacoes, assinatura: d.assinatura
            })) };
        } catch (e) {
            console.error('API searchEtilometria Error:', e);
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
