'use strict';
module.exports = ctx => { ctx.title = 'Paiement des factures du jour'; return require('./_paiement')(ctx, 'jour', 'caisse_jour'); };
