'use strict';
const C = require('../core'); const V = require('../ventes'); const WA = require('../whatsapp'); const { e, money, qty } = C;
module.exports = async ctx => {
  ctx.title = 'Approvisionnements (réception)';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const back = '?p=reception_appro&agence=' + encodeURIComponent(ag);
  if (ctx.req.method === 'POST' && ctx.post('retour')) {
    const r = await C.tx(async () => {
      const p = await C.row("SELECT * FROM t_precommandeagence WHERE idprecommandeagence = ? AND structures = ? AND statut = 'VALIDE_SIEGE' FOR UPDATE", [Number(ctx.post('retour')), ag]);
      if (!p) return null;
      const qte = Number(p.qtevalidee);
      await C.q("UPDATE t_precommandeagence SET accepter = 0, statut = 'RETOURNE_SIEGE', datereception = CURRENT_DATE, recupar = ? WHERE idprecommandeagence = ?", [ctx.uname(), p.idprecommandeagence]);
      if (qte > 0) {
        await C.stockMove(C.SIEGE, p.refarticles, qte);
        await C.q('INSERT INTO t_bonsorti_dp (structures, refarticles, articles, unitevaleur, quantitesortie, datesortie, heure, utilisateur, numprecommande) VALUES (?,?,?,?,?,CURRENT_DATE,LOCALTIME,?,?)',
          [ag, p.refarticles, ('RETOUR ' + p.libarticles).slice(0, 50), p.unitevaleur, -qte, ctx.uname(), p.idcmde]);
      }
      return p;
    });
    if (!r) ctx.flash('Ligne introuvable ou déjà traitée.', 'err');
    else {
      const b = await WA.surReception(r.idcmde, { refuses: [Number(r.idprecommandeagence)] }, ctx.uname()).catch(err => { console.error(err); return null; });
      ctx.flash(`Retour au siège : ${qty(r.qtevalidee)} ${r.unitevaleur} de « ${r.libarticles} » (demandé ${qty(r.qte)}) ont été remis dans le stock du siège. Cette ligne est retirée de votre approvisionnement.` + WA.resume(b), 'info');
    }
    ctx.redirect(back);
  }
  if (ctx.req.method === 'POST') {
    const ids = ctx.arr('ok').map(Number).filter(Boolean);
    if (!ids.length) { ctx.flash('Cochez les lignes reçues avant de valider.', 'err'); ctx.redirect(back); }
    const res = await C.tx(async () => {
      let n = 0; const parCode = {};
      for (const id of ids) {
        const p = await C.row("SELECT * FROM t_precommandeagence WHERE idprecommandeagence = ? AND structures = ? AND statut = 'VALIDE_SIEGE' FOR UPDATE", [id, ag]);
        if (!p) continue;
        await C.q("UPDATE t_precommandeagence SET accepter = 1, statut = 'RECU_AGENCE', datereception = CURRENT_DATE, recupar = ? WHERE idprecommandeagence = ?", [ctx.uname(), id]);
        const qte = Number(p.qtevalidee);
        if (qte > 0) {
          await C.stockMove(ag, p.refarticles, qte);
          await C.q(`INSERT INTO t_appro (refarticles, libarticles, qteappro, dateappro, utilisateur, unitevaleur, fournisseur, annees, mois, numappro, structures, codearticles, prixachat, totalachat)
            VALUES (?,?,?,CURRENT_DATE,?,?,'KFN SIEGE',?,?,?,?,?,?,?)`, [p.refarticles, p.libarticles, qte, ctx.uname(), p.unitevaleur, String(new Date().getFullYear()), C.moisFr(), p.idcmde, ag, p.codearticles, p.pv, Math.round(qte * p.pv)]);
        }
        (parCode[p.idcmde] ||= []).push(p); n++;
      }
      // L'agence est cliente du siège : une facture du siège est émise pour chaque approvisionnement reçu
      const factures = [], parCodeInfo = {};
      for (const [code, lignes] of Object.entries(parCode)) {
        const f = await V.factureAppro(ctx, ag, code, lignes); if (f) factures.push(f);
        parCodeInfo[code] = { acceptes: lignes.map(x => Number(x.idprecommandeagence)), facture: f ? { num: f, montant: lignes.reduce((s, x) => s + Math.round(Number(x.qtevalidee) * Number(x.pv)), 0) } : null };
      }
      return { n, factures, first: Object.keys(parCode)[0] || '', parCodeInfo };
    });
    let wa = '';
    for (const [code, info] of Object.entries(res.parCodeInfo)) wa += WA.resume(await WA.surReception(code, info, ctx.uname()).catch(err => { console.error(err); return null; }));
    ctx.flash(`${res.n} ligne(s) réceptionnée(s) : le stock de ${ag} est mis à jour.` + (res.factures.length ? ` Facture(s) du siège à régler par l'agence : ${res.factures.join(', ')}.` : '') + wa);
    ctx.redirect(back + '&print=' + encodeURIComponent(res.first));
  }
  const lignes = (ctx.get('aff') || ctx.get('agence')) ? await C.rows("SELECT * FROM t_precommandeagence WHERE structures = ? AND statut = 'VALIDE_SIEGE' ORDER BY idcmde, idprecommandeagence", [ag]) : [];
  const recus = (await C.rows("SELECT DISTINCT idcmde FROM t_precommandeagence WHERE structures = ? AND statut = 'RECU_AGENCE' ORDER BY idcmde DESC LIMIT 50", [ag])).map(r => r.idcmde);
  const pr = ctx.get('print'); let t = 0;
  return `<h1 class="page-title">Approvisionnement des produits</h1>
${pr ? `<div class="flash info"><a href="/gestion/print?t=precmd&n=${encodeURIComponent(pr)}" target="_blank">Imprimer la facture d'appro ${e(pr)}</a></div>` : ''}
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="reception_appro"><input type="hidden" name="aff" value="1">
  <div class="f"><label>Date appro</label><input value="${C.dfr(C.today())}" readonly></div><div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag, false, true)}</select></div>
  <button class="btn" style="background:#7C00F0">Afficher</button></form></div>
<form method="post" class="card">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}">
  <div class="row" style="justify-content:space-between;margin-bottom:.8rem">
    <div class="row"><select id="reed" style="max-width:220px">${C.selOptions(recus, null, true, 'Réédition facture appro…')}</select>
      <button type="button" class="btn green" onclick="var v=document.getElementById('reed').value;if(v)window.open('/gestion/print?t=precmd&n='+encodeURIComponent(v));">Rééditer</button></div>
    <button type="button" class="btn ghost" id="all" style="font-style:italic">Tout cocher</button><button class="btn" style="background:#0000E6">Valider</button></div>
  <div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>N° pré-commande</th><th>Référence</th><th>Articles</th><th class="r">Demandé</th><th class="r">Quantité accordée</th><th class="c">Accepté</th><th>Unité</th><th class="r">Prix achat</th><th class="r">Total appro</th><th>Si la quantité ne convient pas</th></tr></thead><tbody>
  ${lignes.map(l => { t += l.qtevalidee * l.pv; return `<tr><td>${e(l.idcmde)}</td><td>${e(l.refarticles)}</td><td>${e(l.libarticles)}</td><td class="r">${qty(l.qte)}</td><td class="r"><b>${qty(l.qtevalidee)}</b></td>
    <td class="c"><input type="checkbox" name="ok[]" value="${l.idprecommandeagence}" aria-label="Accepter"></td><td>${e(l.unitevaleur)}</td><td class="r">${money(l.pv)}</td><td class="r">${money(l.qtevalidee * l.pv)}</td>
    <td><button class="btn sm orange" data-kind="modify" name="retour" value="${l.idprecommandeagence}" data-confirm="Retourner au siège les ${e(qty(l.qtevalidee))} « ${e(l.libarticles)} » accordés ?">Retourner au siège</button></td></tr>`; }).join('') || `<tr><td colspan="10" class="empty">Aucun approvisionnement validé par le siège en attente de réception pour ${e(ag)}.</td></tr>`}
  </tbody>${lignes.length ? `<tfoot><tr><td colspan="8">Total</td><td class="r">${money(t)}</td><td></td></tr></tfoot>` : ''}</table></div>
  <p class="hint">Vérifiez les quantités accordées par le siège, cochez les lignes reçues puis cliquez sur « Valider » : les quantités s'ajoutent au stock de l'agence
  et <b>une facture du siège est émise au nom de l'agence</b> (à régler à la caisse du siège).<br>Si une quantité accordée ne vous convient pas, cliquez sur <b>Retourner au siège</b> : la quantité est remise dans le stock du siège.</p>
</form>
<script>document.getElementById('all').onclick=function(){var c=document.querySelectorAll('input[name="ok[]"]'),all=[].every.call(c,function(x){return x.checked;});c.forEach(function(x){x.checked=!all;});};</script>`;
};
