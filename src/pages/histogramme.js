'use strict';
const C = require('../core'); const { e, money } = C;
module.exports = async ctx => {
  ctx.title = 'Histogramme des objectifs';
  const ag = ctx.agenceOk(ctx.get('agence') || C.SIEGE);
  const data = await C.rows(`SELECT o.annee, o.montant obj,
      (SELECT COALESCE(SUM(mtapayer),0) FROM t_commande c WHERE c.structures = o.structures AND EXTRACT(YEAR FROM c.datecmde)::text = o.annee) ventes,
      (SELECT COALESCE(SUM(verse),0) FROM t_commande c WHERE c.structures = o.structures AND EXTRACT(YEAR FROM c.datecmde)::text = o.annee) paye
    FROM objectif o WHERE o.structures = ? ORDER BY o.annee`, [ag]);
  return `<h1 class="page-title">Bilans — objectifs et réalisations</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="histogramme"><div class="f"><label>Agence</label><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></div></form>
<div class="tbl-wrap" style="margin-top:1rem"><table class="tbl navy"><thead><tr><th>Année</th><th class="r">Objectif annuel à atteindre</th><th class="r">Montant total des ventes</th><th class="r">Montant payé</th><th class="r">Reste à recouvrer</th><th class="r">Taux d'atteinte</th></tr></thead><tbody>
${data.map(d => `<tr><td>${e(d.annee)}</td><td class="r">${money(d.obj)}</td><td class="r">${money(d.ventes)}</td><td class="r">${money(d.paye)}</td><td class="r">${money(d.ventes - d.paye)}</td><td class="r"><b>${d.obj > 0 ? (d.ventes / d.obj * 100).toFixed(1).replace('.', ',') : 0} %</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun objectif défini pour cette agence.</td></tr>'}</tbody></table></div></div>
${data.length ? `<div class="card"><h2>Histogramme</h2><div style="position:relative;height:340px"><canvas id="ch"></canvas></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>new Chart(document.getElementById('ch'),{type:'bar',data:{labels:${JSON.stringify(data.map(d => d.annee))},datasets:[
  {label:'Objectif',data:${JSON.stringify(data.map(d => +d.obj))},backgroundColor:'#BDBDBD'},{label:'Vente totale',data:${JSON.stringify(data.map(d => +d.ventes))},backgroundColor:'#E07F16'},{label:'Vente payée',data:${JSON.stringify(data.map(d => +d.paye))},backgroundColor:'#2E7D32'}]},
  options:{maintainAspectRatio:false,scales:{y:{ticks:{callback:function(v){return KFN.fmt(v);}}}}}});</script>` : ''}`;
};
