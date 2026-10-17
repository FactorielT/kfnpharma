'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Compte des agences clientes';
  let ag = ctx.get('agence') || ctx.post('agence');
  if (!ag || ag === C.SIEGE || !ctx.agences.includes(ag)) ag = '';
  const back = '?p=compte_agences&agence=' + encodeURIComponent(ag);
  if (ctx.req.method === 'POST' && ag) {
    const m = Math.round(num(ctx.post('montant'))), moyen = ctx.post('moyen'), ref = ctx.post('reference');
    const r = await C.tx(async () => {
      const facts = await C.rows('SELECT * FROM t_commande WHERE structures = ? AND nomprenom = ? AND reste > 0 ORDER BY datecmde, idcommande FOR UPDATE', [C.SIEGE, ag]);
      const du = facts.reduce((s, f) => s + f.reste, 0);
      if (m <= 0) return { err: 'Saisissez un montant de versement.' };
      if (m > du) return { err: `Le versement (${money(m)}) dépasse le solde dû par l'agence (${money(du)}).` };
      let rest = m;
      for (const f of facts) {
        if (rest <= 0) break;
        const paye = Math.min(rest, f.reste), reste = f.reste - paye; rest -= paye;
        await C.q(`INSERT INTO t_paiement_sl (numcmde, client, montantcmde, paye, datepaiement, annee, agent, reste, rendu, verse, structures, modepaiement, heure)
          VALUES (?,?,?,?,CURRENT_DATE,?,?,?,0,?,?,?,LOCALTIME)`, [f.numcmde, ag, f.mtapayer, f.verse + paye, String(new Date().getFullYear()), ctx.uname().slice(0, 30), reste, paye, C.SIEGE, moyen]);
        await C.q('UPDATE t_commande SET verse = verse + ?, reste = ? WHERE idcommande = ?', [paye, reste, f.idcommande]);
      }
      await C.q('INSERT INTO t_compteagence (structures, montant_total, verse, dateversement, utilisateur, moyen, reference, solde) VALUES (?,?,?,?,?,?,?,?)', [ag, du, m, ctx.post('date') || C.today(), ctx.uname(), moyen, ref, du - m]);
      return { ok: `Versement de ${money(m)} FCFA de ${ag} enregistré et réparti sur ses factures les plus anciennes.` };
    });
    if (r.err) ctx.flash(r.err, 'err'); else ctx.flash(r.ok);
    ctx.redirect(back);
  }
  const tot = ag ? await C.row('SELECT COALESCE(SUM(mtapayer),0) t, COALESCE(SUM(verse),0) v, COALESCE(SUM(reste),0) r FROM t_commande WHERE structures = ? AND nomprenom = ?', [C.SIEGE, ag]) : { t: 0, v: 0, r: 0 };
  const facts = ag ? await C.rows('SELECT * FROM t_commande WHERE structures = ? AND nomprenom = ? ORDER BY datecmde DESC, idcommande DESC', [C.SIEGE, ag]) : [];
  const vers = ag ? await C.rows('SELECT * FROM t_compteagence WHERE structures = ? ORDER BY dateversement DESC, idt_compteagence DESC LIMIT 100', [ag]) : [];
  return `<h1 class="page-title" style="font-style:italic">Compte des agences clientes du siège</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="compte_agences"><div class="f"><label>Agence cliente</label><select name="agence" data-autosubmit>${ctx.agOptions(ag, true, true)}</select></div></form>
  <div class="kpis" style="margin-top:1rem"><div class="kpi o"><small>Total facturé par le siège (appros et achats)</small><b>${money(tot.t)}</b></div><div class="kpi b"><small>Total versé</small><b>${money(tot.v)}</b></div><div class="kpi ${tot.r > 0 ? 'r' : ''}"><small>Solde dû par l'agence</small><b>${money(tot.r)}</b></div></div>
  ${ag ? `<form method="post" class="row">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}">
    <div class="f"><label>Date</label><input type="date" name="date" value="${C.today()}"></div><div class="f"><label>Montant versé</label><input name="montant" class="num" inputmode="numeric" required></div>
    <div class="f"><label>Moyen de versement</label><select name="moyen">${C.selOptions(['Espèce', 'Chèque', 'Virement', 'Mobile Money', 'Dépôt bancaire'], null, false)}</select></div>
    <div class="f"><label>Référence</label><input name="reference"></div><button class="btn orange" style="font-style:italic">Versement</button></form>
    <p class="hint">Le versement est réparti automatiquement sur les factures les plus anciennes de l'agence. Vous pouvez aussi encaisser une facture précise dans <a href="/gestion?p=caisse_impayes&agence=${encodeURIComponent(C.SIEGE)}">Paiement caisse → impayés</a>.</p>` : '<p class="hint">Choisissez une agence.</p>'}</div>
<div class="card"><h2>Factures du siège à ${e(ag || '…')}</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>N° facture</th><th>Date</th><th>Origine</th><th class="r">Montant</th><th class="r">Versé</th><th class="r">Reste</th></tr></thead><tbody>
${facts.map(f => `<tr data-href="/gestion/print?t=facture&n=${encodeURIComponent(f.numcmde)}"><td>${e(f.numcmde)}</td><td>${C.dfr(f.datecmde)}</td><td>${Number(f.livre) === 2 ? 'Approvisionnement ' + e(f.idclient) : 'Achat au siège'}</td><td class="r">${money(f.mtapayer)}</td><td class="r">${money(f.verse)}</td><td class="r ${f.reste > 0 ? 'neg' : ''}">${money(f.reste)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${ag ? 'Aucune facture pour cette agence.' : 'Choisissez une agence.'}</td></tr>`}</tbody></table></div></div>
${vers.length ? `<div class="card"><h2>Détail des versements</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date</th><th class="r">Dû avant</th><th class="r">Versé</th><th class="r">Solde après</th><th>Moyen</th><th>Référence</th><th>Utilisateur</th></tr></thead><tbody>
${vers.map(v => `<tr><td>${C.dfr(v.dateversement)}</td><td class="r">${money(v.montant_total)}</td><td class="r">${money(v.verse)}</td><td class="r">${money(v.solde)}</td><td>${e(v.moyen)}</td><td>${e(v.reference)}</td><td>${e(v.utilisateur)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
};
