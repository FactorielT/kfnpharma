'use strict';
const C = require('../core'); const { e, qty, num } = C;
module.exports = async ctx => {
  ctx.title = 'Inventaire de stock';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const d0 = new Date(); d0.setMonth(d0.getMonth() - 1);
  const d1 = ctx.get('d1') || ctx.post('d1') || d0.toISOString().slice(0, 10), d2 = ctx.get('d2') || ctx.post('d2') || C.today();
  const mouv = () => C.rows(`SELECT s.idt_stock, s.refarticles, s.codearticles, s.libarticles, s.unitevaleur, s.quantitestock,
      (SELECT COALESCE(SUM(qteappro),0) FROM t_appro a WHERE a.structures = s.structures AND a.refarticles = s.refarticles AND a.dateappro BETWEEN ? AND ?) appro,
      (SELECT COALESCE(SUM(qte),0) FROM t_lignecmde l WHERE l.structures = s.structures AND l.refarticles = s.refarticles AND l.dateenreg BETWEEN ? AND ?) vendu,
      (SELECT COALESCE(SUM(quantitesortie),0) FROM t_bonsorti_dp b WHERE s.structures = ? AND b.refarticles = s.refarticles AND b.datesortie BETWEEN ? AND ?) sorti,
      (SELECT COALESCE(SUM(quantitesorti),0) FROM t_peremption p WHERE p.structures = s.structures AND p.codearticles = s.codearticles AND p.dateoperation BETWEEN ? AND ?) perime
    FROM t_stock s WHERE s.structures = ? ORDER BY s.libarticles`, [d1, d2, d1, d2, C.SIEGE, d1, d2, d1, d2, ag]);
  if (ctx.req.method === 'POST') {
    const phys = ctx.B.phys || {}; let n = 0;
    await C.tx(async () => {
      for (const s of await mouv()) {
        const v = phys['i' + s.idt_stock]; if (v === undefined || v === '') continue;
        const p = num(v), log = Number(s.quantitestock), init = log - s.appro + s.vendu + s.sorti + s.perime;
        await C.q(`INSERT INTO t_inventaire (refarticles, libarticles, quantitestockactuel, unitevaleur, dateinventaire, heure, mois, annee, utilisateur, quantiteappro, quantitevendu, quantitephysique, quantiteecart, quantitejuste, quantiteinitial, structures, codearticles)
          VALUES (?,?,?,?,CURRENT_DATE,LOCALTIME,?,?,?,?,?,?,?,?,?,?,?)`, [s.refarticles, s.libarticles, log, s.unitevaleur, C.moisFr(), String(new Date().getFullYear()), ctx.uname(), s.appro, s.vendu, p, log - p, p, init, ag, s.codearticles]);
        await C.q('UPDATE t_stock SET quantitestock = ? WHERE idt_stock = ?', [p, s.idt_stock]); n++;
      }
    });
    ctx.flash(`Inventaire enregistré : ${n} article(s) ajusté(s) à la quantité physique comptée.`);
    ctx.redirect(`?p=inventaire&agence=${encodeURIComponent(ag)}&d1=${d1}&d2=${d2}`);
  }
  const list = await mouv();
  return `<h1 class="page-title">Inventaire de stock</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="inventaire">
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div><div class="f"><label>Date début</label><input type="date" name="d1" value="${e(d1)}"></div>
  <div class="f"><label>Date fin</label><input type="date" name="d2" value="${e(d2)}"></div><button class="btn" style="background:#003C8F">Afficher</button></form></div>
<form method="post" class="card">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><input type="hidden" name="d1" value="${e(d1)}"><input type="hidden" name="d2" value="${e(d2)}">
  <div class="row" style="justify-content:space-between;margin-bottom:.7rem"><span>Nombre d'articles : <b>${list.length}</b></span><div class="f" style="max-width:320px"><input placeholder="Rechercher…" data-filter="#ti"></div></div>
  <div class="tbl-wrap"><table class="tbl grey" id="ti"><thead><tr><th>Référence</th><th>Articles</th><th>Unité</th><th class="r">Stock initial</th><th class="r">Qté appro</th><th class="r">Qté vendue</th><th class="r">Stock logiciel actuel</th><th class="r">Quantité physique</th><th class="r">Écart</th></tr></thead><tbody>
  ${list.map(s => `<tr><td>${e(s.codearticles)}</td><td>${e(s.libarticles)}</td><td>${e(s.unitevaleur)}</td><td class="r">${qty(s.quantitestock - s.appro + s.vendu + s.sorti + s.perime)}</td><td class="r">${qty(s.appro)}</td><td class="r">${qty(s.vendu)}</td>
    <td class="r"><b data-log="${s.quantitestock}">${qty(s.quantitestock)}</b></td><td class="edit"><input name="phys[i${s.idt_stock}]" inputmode="decimal" placeholder="—" class="phys"></td><td class="r ecart"></td></tr>`).join('')}</tbody></table></div>
  <p class="hint">Saisissez la quantité comptée uniquement pour les articles inventoriés. À l'enregistrement, le stock logiciel est remplacé par la quantité physique et l'écart est historisé.</p>
  <div class="actions"><button class="btn green">Enregistrer l'inventaire</button></div></form>
<script>document.querySelectorAll('.phys').forEach(function(i){i.addEventListener('input',function(){var tr=i.closest('tr'),log=+tr.querySelector('[data-log]').dataset.log,c=tr.querySelector('.ecart');c.textContent=i.value===''?'':KFN.fmt(log-KFN.num(i.value));c.className='r ecart'+((log-KFN.num(i.value))!==0&&i.value!==''?' neg':'');});});</script>`;
};
