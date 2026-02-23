'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.CONFIG = {
    // Attempt to load from localStorage, otherwise empty
    gasUrl: localStorage.getItem('SGE_ETL_URL') || 'https://script.google.com/macros/s/AKfycbyOlkYl09ViWHmCL59B_2Ie2VGNGx6mOZT-wkLrbQQh-WFD2kL1J_6IqClllVBDNxop/exec',
    efetivoUrl: localStorage.getItem('SGE_ETL_EFETIVO_URL') || 'https://script.google.com/macros/s/AKfycbzdLDQOn0jz2ULaljhqtk21BYdWku3K98GbYh5rinllUVERoHYvM7RNY-ZXKApKPQDb/exec',

    appVersion: '2.0.0',
    toastDuration: 3000
};
