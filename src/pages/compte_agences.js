'use strict';
/* =====================================================================
 *  Compte des agences (clientes du siège)
 *  Le siège ne vend pas aux agences : chaque pré-commande validée par le
 *  siège puis acceptée par l'agence devient une facture d'approvisionnement,
 *  c'est-à-dire un IMPAYÉ de l'agence. Ces impayés se règlent ici par des
 *  versements (répartis sur les factures), avec le détail, le solde,
 *  le reste et le suivi.
 *  Siège : enregistre les versements. Agence : consulte son compte.
 * ===================================================================== */
const C = require('../core'); const { e, money } = C;
const MOYENS = ['Espèce', 'Virement', 'Chèque', 'Mobile Money', 'Dépôt bancaire'];
const jours = d => Math.floor((Date.now() - new Date(String(d).slice(0, 10) + 'T00:00:00Z').getTime()) / 864e5);

module.exports = async ctx => {
  ctx.title = 'Compte des agences clientes du siège';
  const siege = ctx.estSiege();
  const peutVerser = siege && ctx.can(['CAI']);           // caissier(ère) du siège, Administrateur, Super Admin
  const peutAnnuler = siege && ctx.canEdit();
  let ag = siege ? (ctx.get('agence') || ctx.post('agence')) : ctx.ustruct();
  const agences = (await C.rows('SELECT nom_structure FROM t_structure WHERE nom_structure <> ? ORDER BY nom_structure', [C.SIEGE])).map(r => r.nom_structure);
  if (ag && !agences.includes(ag)) ag = '';
  const back = '?p=compte_agences' + (ag ? '&agence=' + encodeURIComponent(ag) : '');

  if (ctx.req.method === 'POST') {
    /* ----- Annuler un versement ----- */
    if (ctx.post('annuler')) {
      if (!peutAnnuler) { ctx.flash('Seuls le Super Admin, l’Administrateur et le Responsable du siège peuvent annuler un versement.', 'err'); ctx.redirect(back); }
      const r = await C.tx(async () => {
        const v = await C.row('SELECT * FROM t_compteagence WHERE idt_compteagence = ? AND structures = ? FOR UPDATE', [Number(ctx.post('annuler')), ag]);
        if (!v) return { err: 'Versement introuvable.' };
        const pays = await C.rows('SELECT * FROM t_paiement_sl WHERE idversement = ?', [v.idt_compteagence]);
        for (const p of pays) await C.q('UPDATE t_commande SET verse = GREATEST(0, verse - ?), reste = reste + LEAST(verse, ?) WHERE numcmde = ? AND structures = ?', [p.verse, p.verse, p.numcmde, C.SIEGE]);
        await C.q('DELETE FROM t_paiement_sl WHERE idversement = ?', [v.idt_compteagence]);
        await C.q('DELETE FROM t_compteagence WHERE idt_compteagence = ?', [v.idt_compteagence]);
        return { msg: `Versement de ${money(v.verse)} FCFA du ${C.dfr(v.dateversement)} annulé : les factures concernées sont de nouveau dues.` };
      });
      ctx.flash(r.err || r.msg, r.err ? 'err' : 'ok'); ctx.redirect(back);
    }
    /* ----- Enregistrer un versement ----- */
    if (!peutVerser) { ctx.flash('Les versements des agences sont enregistrés par le siège.', 'err'); ctx.redirect(back); }
    if (!ag) { ctx.flash('Choisissez une agence.', 'err'); ctx.redirect(back); }
    const m = Math.round(C.num(ctx.post('montant'))), moyen = ctx.post('moyen'), ref = ctx.post('reference'), dateV = ctx.post('date') || C.today();
    const cibles = ctx.arr('factures');
    const r = await C.tx(async () => {
      let facts = await C.rows('SELECT * FROM t_commande WHERE structures = ? AND nomprenom = ? AND reste > 0 ORDER BY datecmde, idcommande FOR UPDATE', [C.SIEGE, ag]);
      if (cibles.length) facts = facts.filter(f => cibles.includes(f.numcmde));
      const du = facts.reduce((s, f) => s + f.reste, 0), duTotal = Number(await C.val('SELECT COALESCE(SUM(reste),0) FROM t_commande WHERE structures = ? AND nomprenom = ?', [C.SIEGE, ag]));
      if (m <= 0) return { err: 'Saisissez le montant versé.' };
      if (!facts.length) return { err: "Cette agence n'a aucune facture impayée." };
      if (m > du) return { err: `Le versement (${money(m)}) dépasse le reste à payer des factures choisies (${money(du)}).` };
      const vid = await C.val(`INSERT INTO t_compteagence (structures, montant_total, verse, dateversement, utilisateur, moyen, reference, solde, factures)
        VALUES (?,?,?,?,?,?,?,?,?) RETURNING idt_compteagence`, [ag, duTotal, m, dateV, ctx.uname(), moyen, ref, duTotal - m, '']);
      let rest = m; const regles = [];
      for (const f of facts) {
        if (rest <= 0) break;
        const paye = Math.min(rest, f.reste), reste = f.reste - paye; rest -= paye;
        await C.q(`INSERT INTO t_paiement_sl (numcmde, client, montantcmde, paye, datepaiement, annee, agent, reste, rendu, verse, structures, modepaiement, heure, idversement)
          VALUES (?,?,?,?,?,?,?,?,0,?,?,?,LOCALTIME,?)`, [f.numcmde, ag, f.mtapayer, f.verse + paye, dateV, dateV.slice(0, 4), ctx.uname().slice(0, 30), reste, paye, C.SIEGE, moyen, vid]);
        await C.q('UPDATE t_commande SET verse = verse + ?, reste = ? WHERE idcommande = ?', [paye, reste, f.idcommande]);
        regles.push(`${f.numcmde} : ${money(paye)}${reste ? ' (reste ' + money(reste) + ')' : ' (soldée)'}`);
      }
      await C.q('UPDATE t_compteagence SET factures = ? WHERE idt_compteagence = ?', [regles.join(' ; '), vid]);
      return { vid, msg: `Versement de ${money(m)} FCFA de ${ag} enregistré. Reste à payer par l'agence : ${money(duTotal - m)} FCFA.` };
    });
    if (r.err) { ctx.flash(r.err, 'err'); ctx.redirect(back); }
    ctx.flash(r.msg); ctx.redirect(back + '&recu=' + r.vid);
  }

  /* ----- Suivi de toutes les agences (siège, aucune agence choisie) ----- */
  if (!ag) {
    const suivi = await C.rows(`SELECT s.nom_structure ag,
        COUNT(c.idcommande) nb, COALESCE(SUM(c.mtapayer),0) total, COALESCE(SUM(c.verse),0) verse, COALESCE(SUM(c.reste),0) reste,
        MIN(c.datecmde) FILTER (WHERE c.reste > 0) plus_ancien, COUNT(c.idcommande) FILTER (WHERE c.reste > 0) nb_impayes,
        (SELECT MAX(dateversement) FROM t_compteagence v WHERE v.structures = s.nom_structure) dernier
      FROM t_structure s LEFT JOIN t_commande c ON c.structures = ? AND c.nomprenom = s.nom_structure
      WHERE s.nom_structure <> ? GROUP BY s.nom_structure ORDER BY COALESCE(SUM(c.reste),0) DESC, s.nom_structure`, [C.SIEGE, C.SIEGE]);
    const T = k => suivi.reduce((a, x) => a + Number(x[k]), 0);
    return `<h1 class="page-title">Compte des agences clientes du siège — suivi</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="compte_agences"><div class="f"><label>Agence</label><select name="agence" data-autosubmit><option value="">— Toutes (suivi) —</option>${C.selOptions(agences, '', false)}</select></div></form>
  <div class="kpis" style="margin-top:1rem"><div class="kpi o"><small>Total facturé aux agences (appros acceptés)</small><b>${money(T('total'))}</b></div><div class="kpi b"><small>Total versé</small><b>${money(T('verse'))}</b></div>
  <div class="kpi r"><small>Reste à payer par les agences</small><b>${money(T('reste'))}</b></div></div>
  <p class="hint">Le siège ne vend pas aux agences : chaque pré-commande validée par le siège et acceptée par l'agence devient une facture d'approvisionnement, c'est-à-dire un impayé de l'agence, réglé ici par des versements.</p></div>
<div class="card"><div class="tbl-wrap" style="max-height:none"><table class="tbl grey" id="ts"><thead><tr><th>Agence</th><th class="r">Factures</th><th class="r">Total facturé</th><th class="r">Versé</th><th class="r">Reste (solde dû)</th><th class="r">Factures impayées</th><th>Plus ancien impayé</th><th>Dernier versement</th></tr></thead><tbody>
${suivi.map(x => `<tr data-href="/gestion?p=compte_agences&agence=${encodeURIComponent(x.ag)}"><td><b>${e(x.ag)}</b></td><td class="r">${x.nb}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.verse)}</td><td class="r ${x.reste > 0 ? 'neg' : ''}"><b>${money(x.reste)}</b></td><td class="r">${x.nb_impayes}</td>
  <td>${x.plus_ancien ? `${C.dfr(x.plus_ancien)} <span class="badge ${jours(x.plus_ancien) > 30 ? 'r' : 'o'}">${jours(x.plus_ancien)} j</span>` : '—'}</td><td>${C.dfr(x.dernier) || '—'}</td></tr>`).join('')}</tbody>
<tfoot><tr><td>Total</td><td class="r">${T('nb')}</td><td class="r">${money(T('total'))}</td><td class="r">${money(T('verse'))}</td><td class="r">${money(T('reste'))}</td><td class="r">${T('nb_impayes')}</td><td colspan="2"></td></tr></tfoot></table></div>
<div class="actions"><button type="button" class="btn green" data-print>Imprimer</button><button type="button" class="btn ghost" data-export="#ts" data-name="suivi-comptes-agences">Exporter (Excel)</button></div>
<p class="hint">Touchez une agence pour voir ses factures, ses versements et enregistrer un nouveau versement.</p></div>`;
  }

  /* ----- Compte d'une agence ----- */
  const tot = await C.row('SELECT COALESCE(SUM(mtapayer),0) t, COALESCE(SUM(verse),0) v, COALESCE(SUM(reste),0) r, COUNT(*) FILTER (WHERE reste > 0) n FROM t_commande WHERE structures = ? AND nomprenom = ?', [C.SIEGE, ag]);
  const facts = await C.rows('SELECT * FROM t_commande WHERE structures = ? AND nomprenom = ? ORDER BY (reste > 0) DESC, datecmde, idcommande', [C.SIEGE, ag]);
  const vers = await C.rows('SELECT * FROM t_compteagence WHERE structures = ? ORDER BY dateversement DESC, idt_compteagence DESC LIMIT 200', [ag]);
  const recu = ctx.get('recu'), impayes = facts.filter(f => f.reste > 0);
  return `<h1 class="page-title" style="font-style:italic">Compte de ${e(ag)} auprès du siège</h1>
${recu ? `<div class="flash info" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">Reçu de versement prêt. <a class="btn green" target="_blank" href="/gestion/print?t=versement&n=${encodeURIComponent(recu)}">Imprimer le reçu</a></div>` : ''}
<div class="card">
  ${siege ? `<form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="compte_agences"><div class="f"><label>Agence cliente</label><select name="agence" data-autosubmit><option value="">— Toutes (suivi) —</option>${C.selOptions(agences, ag, false)}</select></div></form>` : '<p class="hint" style="margin-top:0">Votre agence est cliente du siège : voici ce qu’elle doit au siège pour ses approvisionnements acceptés, et ses versements.</p>'}
  <div class="kpis" style="margin-top:1rem"><div class="kpi o"><small>Total facturé (appros acceptés)</small><b>${money(tot.t)}</b></div><div class="kpi b"><small>Total versé</small><b>${money(tot.v)}</b></div>
  <div class="kpi ${tot.r > 0 ? 'r' : ''}"><small>Solde / reste à payer</small><b>${money(tot.r)}</b><small>${tot.n} facture(s) impayée(s)</small></div></div>
</div>
${peutVerser ? `<h1 class="page-title" style="background:var(--orange)">Enregistrer un versement de ${e(ag)}</h1>
<form method="post" class="card" id="fv">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}">
  <div class="grid g4"><div class="f"><label>Date</label><input type="date" name="date" value="${C.today()}"></div>
  <div class="f"><label>Montant versé</label><input name="montant" id="mv" class="big" inputmode="numeric" required></div>
  <div class="f"><label>Moyen de versement</label><select name="moyen">${C.selOptions(MOYENS, null, false)}</select></div><div class="f"><label>Référence (n° de chèque, de virement…)</label><input name="reference"></div></div>
  <p class="hint">Cochez les factures à régler, ou ne cochez rien : le versement est réparti automatiquement des plus anciennes aux plus récentes.</p>
  <div class="tbl-wrap"><table class="tbl grey"><thead><tr><th class="c">Régler</th><th>N° facture</th><th>Date</th><th>Pré-commande</th><th class="r">Montant</th><th class="r">Versé</th><th class="r">Reste</th><th class="r">Ancienneté</th></tr></thead><tbody>
  ${impayes.map(f => `<tr><td class="c"><input type="checkbox" name="factures" value="${e(f.numcmde)}" data-reste="${f.reste}"></td><td>${e(f.numcmde)}</td><td>${C.dfr(f.datecmde)}</td><td>${e(f.idclient)}</td><td class="r">${money(f.mtapayer)}</td><td class="r">${money(f.verse)}</td><td class="r neg"><b>${money(f.reste)}</b></td><td class="r"><span class="badge ${jours(f.datecmde) > 30 ? 'r' : 'o'}">${jours(f.datecmde)} j</span></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucune facture impayée : le compte est à jour.</td></tr>'}</tbody></table></div>
  <div class="row" style="justify-content:space-between;margin-top:.8rem"><span class="hint" id="sel">Reste des factures cochées : —</span>${impayes.length ? '<button class="btn orange" style="min-width:180px">Enregistrer le versement</button>' : ''}</div></form>` : ''}
<h1 class="page-title" style="background:var(--green-d)">Factures d'approvisionnement de ${e(ag)}</h1>
<div class="card"><div class="tbl-wrap"><table class="tbl grey" id="tf"><thead><tr><th>N° facture</th><th>Date</th><th>Pré-commande</th><th class="r">Montant</th><th class="r">Versé</th><th class="r">Reste</th><th>État</th></tr></thead><tbody>
${facts.map(f => `<tr class="click" data-detail="type=facture&num=${encodeURIComponent(f.numcmde)}"><td>${e(f.numcmde)}</td><td>${C.dfr(f.datecmde)}</td><td>${e(f.idclient)}</td><td class="r">${money(f.mtapayer)}</td><td class="r">${money(f.verse)}</td><td class="r ${f.reste > 0 ? 'neg' : ''}">${money(f.reste)}</td>
  <td>${f.reste <= 0 ? '<span class="badge">Soldée</span>' : (f.verse > 0 ? '<span class="badge o">Partiellement réglée</span>' : '<span class="badge r">Impayée</span>')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune facture : aucune pré-commande acceptée pour le moment.</td></tr>'}</tbody>
${facts.length ? `<tfoot><tr><td colspan="3">Total</td><td class="r">${money(tot.t)}</td><td class="r">${money(tot.v)}</td><td class="r">${money(tot.r)}</td><td></td></tr></tfoot>` : ''}</table></div>
<p class="hint no-print">Touchez une facture pour voir ses articles et les paiements reçus.</p></div>
<h1 class="page-title" style="background:var(--green-d)">Détails des versements</h1>
<div class="card"><div class="tbl-wrap"><table class="tbl grey" id="tv"><thead><tr><th>Date</th><th class="r">Dû avant</th><th class="r">Versé</th><th class="r">Solde après</th><th>Moyen</th><th>Référence</th><th>Factures réglées</th><th>Saisi par</th><th></th></tr></thead><tbody>
${vers.map(v => `<tr><td>${C.dfr(v.dateversement)}</td><td class="r">${money(v.montant_total)}</td><td class="r"><b>${money(v.verse)}</b></td><td class="r">${money(v.solde)}</td><td>${e(v.moyen)}</td><td>${e(v.reference)}</td><td style="white-space:normal;min-width:220px;font-size:.82rem">${e(v.factures || '')}</td><td>${e(v.utilisateur)}</td>
  <td class="r" style="white-space:nowrap"><a class="btn sm ghost" target="_blank" href="/gestion/print?t=versement&n=${v.idt_compteagence}">Reçu</a>${peutAnnuler ? ` <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><button class="btn sm red" name="annuler" value="${v.idt_compteagence}">Annuler</button></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Aucun versement enregistré.</td></tr>'}</tbody>
${vers.length ? `<tfoot><tr><td colspan="2">Total versé</td><td class="r">${money(vers.reduce((a, v) => a + v.verse, 0))}</td><td colspan="6"></td></tr></tfoot>` : ''}</table></div>
<div class="actions"><button type="button" class="btn green" data-print>Imprimer le relevé</button><button type="button" class="btn ghost" data-export="#tv" data-name="versements-${e(ag)}">Exporter (Excel)</button></div></div>
<script>
document.querySelectorAll('tr[data-detail]').forEach(function(tr){tr.addEventListener('click',function(){KFN.details(tr.dataset.detail);});});
(function(){var c=document.querySelectorAll('input[name="factures"]'),s=document.getElementById('sel');if(!s)return;
  function u(){var t=0,n=0;c.forEach(function(x){if(x.checked){t+=+x.dataset.reste;n++;}});s.textContent=n?('Reste des '+n+' facture(s) cochée(s) : '+KFN.fmt(t)+' FCFA'):'Aucune facture cochée : répartition automatique sur les plus anciennes.';if(n)document.getElementById('mv').value=t;}
  c.forEach(function(x){x.addEventListener('change',u);});u();})();
</script>`;
};
