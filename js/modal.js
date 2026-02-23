'use strict';

window.SGE_ETL = window.SGE_ETL || {};

SGE_ETL.modal = {
    open(title, bodyHtml, footerHtml) {
        document.querySelector('.modal-title').textContent = title;
        document.querySelector('.modal-body').innerHTML = bodyHtml;
        document.querySelector('.modal-footer').innerHTML = footerHtml;

        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById('modal').classList.add('active');
    },

    close() {
        document.getElementById('modal').classList.remove('active');
        document.getElementById('modal-overlay').classList.remove('active');
    }
};
