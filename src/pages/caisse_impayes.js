'use strict';
module.exports = ctx => { ctx.title = 'Paiement des impayés'; return require('./_paiement')(ctx, 'credit', 'caisse_impayes'); };
