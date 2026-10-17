'use strict';
/* Inventaire de stock
   Date initiale = date du dernier inventaire de l'agence (fixe) ; 1er inventaire : date du jour (fixe).
   « Au » = date du jour, modifiable.
   Stock départ = stock du dernier inventaire (qté réelle) + appros sur la période.
   Écart = stock logiciel − inventaire physique. La QTE RÉELLE (stock logiciel par défaut, modifiable)
   remplace le stock de l'agence ; l'écart est historisé et une fiche imprimable (PDF) est produite. */
const C = require('../core'); const { e, qty, num } = C;
module.exports = async ctx => {
  ctx.title = 'Inventaire de stock';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const dernier = await C.val('SELECT MAX(dateinventaire) FROM t_inventaire WHERE structures = ?', [ag]);
  const dInit = dernier ? String(dernier).slice(0, 10) : C.today();
  let au = ctx.get('d2') || ctx.post('d2') || C.today(); if (au < dInit) au = dInit;
  const lignes = () => C.rows(`SELECT s.idt_stock, s.refarticles, s.codearticles, s.libarticles, s.unitevaleur, s.quantitestock AS logiciel,
      COALESCE((SELECT i.quantitejuste FROM t_inventaire i WHERE i.structures = s.structures AND i.refarticles = s.refarticles ORDER BY i.dateinventaire DESC, i.idt_inventaire DESC LIMIT 1), 0) AS dernier,
      (SELECT COALESCE(SUM(qteappro),0) FROM t_appro a WHERE a.structures = s.structures AND a.refarticles = s.refarticles AND a.dateappro BETWEEN ? AND ?) AS appro
    FROM t_stock s WHERE s.structures = ? ORDER BY s.libarticles`, [dInit, au, ag]);
  if (ctx.req.method === 'POST') {
    const phys = ctx.B.phys || {}, reel = ctx.B.reel || {};
    const r = await C.tx(async () => {
      const numInv = 'INV' + C.today().slice(2).replace(/-/g, '') + '-' + await C.nextCounter('numcb') + await C.codeAgence(ag);
      let n = 0, ecarts = 0;
      for (const s of await lignes()) {
        const k = 'i' + s.idt_stock, p = phys[k] === undefined || phys[k] === '' ? null : num(phys[k]);
        const q = reel[k] === undefined || reel[k] === '' ? Number(s.logiciel) : num(reel[k]);
        const ecart = p === null ? 0 : Number(s.logiciel) - p; if (ecart) ecarts++;
        await C.q(`INSERT INTO t_inventaire (refarticles, libarticles, quantitestockactuel, unitevaleur, dateinventaire, heure, mois, annee, utilisateur, quantiteappro, quantitevendu,
            quantitephysique, quantiteecart, quantitejuste, quantiteinitial, structures, codearticles, numinventaire, datedebut)
          VALUES (?,?,?,?,?,LOCALTIME,?,?,?,?,0,?,?,?,?,?,?,?,?)`, [s.refarticles, s.libarticles, s.logiciel, s.unitevaleur, au, C.moisFr(au), au.slice(0, 4), ctx.uname(), s.appro,
          p === null ? 0 : p, ecart, q, s.dernier, ag, s.codearticles, numInv, dInit]);
        await C.q('UPDATE t_stock SET quantitestock = ? WHERE idt_stock = ?', [q, s.idt_stock]); n++;
      }
      return { numInv, n, ecarts };
    });
    ctx.flash(`Inventaire ${r.numInv} enregistré : ${r.n} article(s), stock de ${ag} remplacé par la colonne QTE RÉELLE (${r.ecarts} écart(s) historisé(s)).`);
    ctx.redirect(`?p=inventaire&agence=${encodeURIComponent(ag)}&fiche=${encodeURIComponent(r.numInv)}`);
  }
  const list = await lignes(), fiche = ctx.get('fiche');
  const anciens = await C.rows("SELECT numinventaire, MAX(dateinventaire) d FROM t_inventaire WHERE structures = ? AND numinventaire IS NOT NULL GROUP BY numinventaire ORDER BY MAX(idt_inventaire) DESC LIMIT 10", [ag]);
  return `<h1 class="page-title">Inventaire de stock</h1>
${fiche ? `<div class="flash info" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">Fiche d'inventaire <b>${e(fiche)}</b> prête. <a class="btn green" target="_blank" href="/gestion/print?t=inventaire&n=${encodeURIComponent(fiche)}">Imprimer / enregistrer en PDF</a></div>` : ''}
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="inventaire">
  <div class="f"><label>Agence</label><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></div>
  <div class="f" style="max-width:190px"><label>Date initiale ${dernier ? '(dernier inventaire)' : '(1er inventaire)'}</label><input type="date" value="${dInit}" readonly title="Date fixe, non modifiable"></div>
  <div class="f" style="max-width:190px"><label>Au</label><input type="date" name="d2" value="${au}" min="${dInit}"></div>
  <button class="btn" style="background:#5CB85C">Afficher</button>
  ${anciens.length ? `<div class="f" style="max-width:260px"><label>Fiches précédentes</label><select onchange="if(this.value)window.open('/gestion/print?t=inventaire&n='+encodeURIComponent(this.value))">${C.selOptions(anciens.map(a => a.numinventaire), null, true, '— Rééditer une fiche —')}</select></div>` : ''}</form></div>
<form method="post" class="card" data-confirm="Lorsque vous validez cet enregistrement, la quantité de la colonne QTE RÉELLE remplacera le stock de l'agence ${e(ag)}. Continuer ?">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><input type="hidden" name="d2" value="${au}">
  <div class="row" style="justify-content:space-between;margin-bottom:.7rem"><span>${list.length} article(s) — période du <b>${C.dfr(dInit)}</b> au <b>${C.dfr(au)}</b></span>
    <div class="row"><button type="button" class="btn sm ghost" id="cp">Qté réelle = inventaire physique</button><div class="f" style="max-width:280px"><input placeholder="Rechercher…" data-filter="#ti"></div></div></div>
  <div class="tbl-wrap" style="max-height:65vh"><table class="tbl inv" id="ti"><thead><tr><th>Libellé</th><th class="r">Stock dernier inventaire</th><th class="r">Stock appro sur période</th><th class="r">Stock départ</th><th class="r">Stock actuel logiciel</th><th class="r">Inventaire physique</th><th class="r">Écart stock</th><th class="r">Qté réelle</th></tr></thead><tbody>
  ${list.map(s => `<tr data-log="${s.logiciel}"><td>${e(s.libarticles)}</td><td class="r">${qty(s.dernier)}</td><td class="r">${qty(s.appro)}</td><td class="r"><b>${qty(Number(s.dernier) + Number(s.appro))}</b></td><td class="r"><b>${qty(s.logiciel)}</b></td>
    <td class="edit"><input name="phys[i${s.idt_stock}]" inputmode="decimal" class="phys" placeholder="—"></td><td class="r ecart">0</td>
    <td class="edit"><input name="reel[i${s.idt_stock}]" inputmode="decimal" class="reel" value="${s.logiciel}"></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun article dans le stock de cette agence.</td></tr>'}</tbody></table></div>
  <p class="hint">Écart = stock logiciel − inventaire physique. En cas d'écart, le responsable inscrit sa décision dans <b>QTE RÉELLE</b> (stock logiciel par défaut) :
  à l'enregistrement, cette quantité remplace le stock de l'agence, l'écart est historisé et la fiche d'inventaire est éditable en PDF.</p>
  <div class="actions"><button class="btn green" style="min-width:180px">Valider ✓</button></div></form>
<script>
(function(){function upd(tr){var log=+tr.dataset.log,p=tr.querySelector('.phys'),c=tr.querySelector('.ecart'),ec=p.value===''?0:log-KFN.num(p.value);c.textContent=KFN.fmt(ec);c.className='r ecart'+(ec?' neg':'');}
  document.querySelectorAll('#ti tbody tr[data-log]').forEach(function(tr){tr.querySelector('.phys').addEventListener('input',function(){upd(tr);});});
  document.getElementById('cp').onclick=function(){var n=0;document.querySelectorAll('#ti tbody tr[data-log]').forEach(function(tr){var p=tr.querySelector('.phys');if(p.value!==''){tr.querySelector('.reel').value=KFN.num(p.value);n++;}});KFN.toast(n+' quantité(s) réelle(s) reprise(s) de l’inventaire physique.','info');};})();
</script>`;
};
