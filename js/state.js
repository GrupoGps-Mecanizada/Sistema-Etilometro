'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.state = {
    activeView: 'aplicacao',
    dataLoaded: false,

    // Auth
    user: null, // Holds currently logged user / operator settings

    // Etilometria Shift / Planão logic
    plantao: {
        ativo: false,
        operador: '',
        aparelho: '',
        local: ''
    },

    // Data
    testes_diario: [], // Used for fast retrieval today
    testes_pesquisa: [], // Used for search results

    // UI State
    drawerTeste: null, // teste currently open in drawer

    filtros: {
        date: '',
        name: '',
        status: ''
    }
};
