'use strict';
const C = require('../core'); const { e, money, qty } = C;
const CRIT = { ca: "Chiffre d'affaires", encaisse: 'Montant encaissé', factures: 'Nombre de factures', qte: 'Quantités vendues' };
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const pct = v => v.toFixed(1).replace('.', ',') + ' %';
module.exports = async ctx => {
  ctx.title = 'Statistique de vente par agence';
  const mode = ['annee', 'mois', 'periode'].includes(ctx.get('mode')) ? ctx.get('mode') : 'annee';
  const td = C.today(), an = Number(ctx.get('an') || td.slice(0, 4)), mo = Math.max(1, Math.min(12, Number(ctx.get('mo') || td.slice(5, 7))));
  let d1, d2, p1, p2, egal = false;
  if (mode === 'annee') { d1 = `${an}-01-01`; d2 = `${an}-12-31`; p1 = `${an - 1}-01-01`; p2 = `${an - 1}-12-31`; }
  else if (mode === 'mois') { d1 = `${an}-${C.pad(mo)}-01`; d2 = lastDay(an, mo); const pm = mo === 1 ? 12 : mo - 1, py = mo === 1 ? an - 1 : an; p1 = `${py}-${C.pad(pm)}-01`; p2 = lastDay(py, pm); }
  else { d1 = ctx.get('d1') || td.slice(0, 4) + '-01-01'; d2 = ctx.get('d2') || td; if (d1 > d2) [d1, d2] = [d2, d1]; const j = Math.round((new Date(d2) - new Date(d1)) / 864e5) + 1; p2 = addDays(d1, -1); p1 = addDays(p2, -(j - 1)); }
  if (mode === 'annee' && an === Number(td.slice(0, 4))) { d2 = td; p2 = (an - 1) + td.slice(4); egal = true; }
  if (mode === 'mois' && d1.slice(0, 7) === td.slice(0, 7)) { d2 = td; p2 = p1.slice(0, 8) + C.pad(Math.min(Number(td.slice(8, 10)), Number(p2.slice(8, 10)))); egal = true; }
  const crit = CRIT[ctx.get('crit')] ? ctx.get('crit') : 'ca', key = { ca: 'ca', encaisse: 'enc', factures: 'nb', qte: 'qte' }[crit];
  const agences = (await C.rows('SELECT nom_structure FROM t_structure ORDER BY estsiege DESC, nom_structure')).map(r => r.nom_structure);
  const ventes = async (a, b) => {
    const o = {};
    for (const r of await C.rows('SELECT structures ag, COUNT(*) nb, COALESCE(SUM(mtapayer),0) ca, COALESCE(SUM(verse),0) enc, COALESCE(SUM(reste),0) reste FROM t_commande WHERE datecmde BETWEEN ? AND ? GROUP BY structures', [a, b])) o[r.ag] = r;
    for (const r of await C.rows('SELECT structures ag, COALESCE(SUM(qte),0) q FROM t_lignecmde WHERE dateenreg BETWEEN ? AND ? GROUP BY structures', [a, b])) (o[r.ag] ||= {}).qte = r.q;
    return o;
  };
  const cur = await ventes(d1, d2), prev = await ventes(p1, p2), obj = {}, top = {};
  if (mode === 'annee') for (const r of await C.rows('SELECT structures, montant FROM objectif WHERE annee = ?', [String(an)])) obj[r.structures] = Number(r.montant);
  for (const r of await C.rows('SELECT structures ag, libarticles lib, SUM(mtapayer) t FROM t_lignecmde WHERE dateenreg BETWEEN ? AND ? GROUP BY structures, libarticles ORDER BY t DESC', [d1, d2])) if (!top[r.ag]) top[r.ag] = r.lib;
  const L = agences.map(a => { const c = cur[a] || {}, p = prev[a] || {}; const l = { ag: a, nb: Number(c.nb || 0), qte: Number(c.qte || 0), ca: Number(c.ca || 0), enc: Number(c.enc || 0), reste: Number(c.reste || 0), prev: Number(p.ca || 0), obj: obj[a] || 0, top: top[a] || '—' };
    l.panier = l.nb ? Math.round(l.ca / l.nb) : 0; l.evol = l.prev > 0 ? (l.ca - l.prev) / l.prev * 100 : null; return l; })
    .sort((x, y) => (y[key] - x[key]) || (y.ca - x.ca));
  const T = { nb: 0, qte: 0, ca: 0, enc: 0, reste: 0, prev: 0, obj: 0 }; for (const l of L) for (const k in T) T[k] += l[k];
  const act = L.filter(l => l.nb > 0);
  const anG = mode === 'periode' ? Number(d2.slice(0, 4)) : an, mens = {};
  for (const r of await C.rows('SELECT structures ag, EXTRACT(MONTH FROM datecmde)::int m, SUM(mtapayer) ca FROM t_commande WHERE EXTRACT(YEAR FROM datecmde) = ? GROUP BY structures, EXTRACT(MONTH FROM datecmde)', [anG])) (mens[r.ag] ||= {})[r.m] = Number(r.ca);
  const annees = (await C.rows('SELECT DISTINCT EXTRACT(YEAR FROM datecmde)::int a FROM t_commande WHERE datecmde IS NOT NULL ORDER BY a DESC')).map(r => r.a);
  if (!annees.includes(an)) annees.push(an); annees.sort((a, b) => b - a);
  const lib = mode === 'annee' ? `Année ${an}` : (mode === 'mois' ? `${C.MOIS[mo]} ${an}` : `Du ${C.dfr(d1)} au ${C.dfr(d2)}`);
  const med = ['🥇', '🥈', '🥉'], maxv = L[0]?.[key] || 0;
  return `<h1 class="page-title">Statistique de vente par agence</h1>
<div class="card no-print"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="statistiques">
  <div class="f"><label>Période</label><select name="mode" id="mode"><option value="annee"${mode === 'annee' ? ' selected' : ''}>Sur l'année</option><option value="mois"${mode === 'mois' ? ' selected' : ''}>Sur un mois</option><option value="periode"${mode === 'periode' ? ' selected' : ''}>Période donnée (date début / date fin)</option></select></div>
  <div class="f m-an"><label>Année</label><select name="an">${annees.map(a => `<option${a === an ? ' selected' : ''}>${a}</option>`).join('')}</select></div>
  <div class="f m-mo"><label>Mois</label><select name="mo">${C.MOIS.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
  <div class="f m-pe"><label>Date début</label><input type="date" name="d1" value="${e(d1)}"></div><div class="f m-pe"><label>Date fin</label><input type="date" name="d2" value="${e(d2)}"></div>
  <div class="f"><label>Classer selon</label><select name="crit">${C.selOptions(CRIT, crit, false)}</select></div>
  <button class="btn" style="background:#0000C8">Afficher</button><button type="button" class="btn green" data-print>Imprimer</button><button type="button" class="btn ghost" data-export="#tclass" data-name="classement-agences">Exporter (Excel)</button></form></div>
<div class="card"><p class="hint" style="margin-top:0">KFN PHARMA — <b>${e(lib)}</b> — classement selon : <b>${e(CRIT[crit])}</b> — comparaison avec : ${mode === 'annee' ? 'année ' + (an - 1) : (mode === 'mois' ? 'mois précédent' : 'la période précédente de même durée')}${egal ? ' (à date égale)' : ''}</p>
  <div class="kpis"><div class="kpi"><small>Chiffre d'affaires total</small><b>${money(T.ca)} FCFA</b><small>${T.prev > 0 ? (T.ca >= T.prev ? '▲ ' : '▼ ') + pct(Math.abs((T.ca - T.prev) / T.prev * 100)) + ' vs période précédente' : 'Pas de comparaison'}</small></div>
  <div class="kpi b"><small>Montant encaissé</small><b>${money(T.enc)}</b><small>${T.ca ? pct(T.enc / T.ca * 100) + ' du CA' : ''}</small></div>
  <div class="kpi r"><small>Reste à recouvrer (crédits)</small><b>${money(T.reste)}</b></div>
  <div class="kpi o"><small>Factures / quantités vendues</small><b>${money(T.nb)}</b><small>${qty(T.qte)} articles</small></div>
  <div class="kpi"><small>Agence n°1</small><b style="font-size:1.1rem">${act.length ? e(L[0].ag) : '—'}</b><small>${act.length ? money(L[0][key]) + (key === 'ca' || key === 'enc' ? ' FCFA' : '') : 'Aucune vente sur la période'}</small></div></div></div>
<h1 class="page-title" style="background:var(--green-d)">Classement des agences — ${e(lib)}</h1>
<div class="card"><div class="tbl-wrap" style="max-height:none"><table class="tbl grey" id="tclass"><thead><tr><th>Rang</th><th>Agence</th><th class="r">Factures</th><th class="r">Qtés vendues</th><th class="r">Chiffre d'affaires</th><th class="r">Part</th><th class="r">Encaissé</th><th class="r">Reste</th><th class="r">Panier moyen</th><th class="r">Évolution</th>${mode === 'annee' ? '<th class="r">Objectif</th><th class="r">Atteinte</th>' : ''}<th>Meilleure vente</th></tr></thead><tbody>
${L.map((l, i) => `<tr${l.nb ? '' : ' style="opacity:.55"'}><td class="c" style="font-weight:800;font-size:1.05rem">${l.nb ? (med[i] || i + 1) : '—'}</td>
  <td><b>${e(l.ag)}</b><div style="height:6px;background:#EEF2EF;border-radius:4px;margin-top:4px;min-width:90px"><div style="height:6px;border-radius:4px;background:${i ? 'var(--green)' : 'var(--orange)'};width:${maxv ? Math.round(l[key] / maxv * 100) : 0}%"></div></div></td>
  <td class="r">${money(l.nb)}</td><td class="r">${qty(l.qte)}</td><td class="r"><b>${money(l.ca)}</b></td><td class="r">${T.ca ? pct(l.ca / T.ca * 100) : '0 %'}</td><td class="r">${money(l.enc)}</td><td class="r ${l.reste > 0 ? 'neg' : ''}">${money(l.reste)}</td><td class="r">${money(l.panier)}</td>
  <td class="r" style="font-weight:700;color:${l.evol === null ? 'inherit' : (l.evol >= 0 ? 'var(--green)' : 'var(--red)')}">${l.evol === null ? '—' : (l.evol >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(l.evol))}</td>
  ${mode === 'annee' ? `<td class="r">${l.obj ? money(l.obj) : '—'}</td><td class="r">${l.obj ? pct(l.ca / l.obj * 100) : '—'}</td>` : ''}<td>${e(l.top)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td></td><td>Total (${act.length} agence(s) active(s))</td><td class="r">${money(T.nb)}</td><td class="r">${qty(T.qte)}</td><td class="r">${money(T.ca)}</td><td class="r">100 %</td><td class="r">${money(T.enc)}</td><td class="r">${money(T.reste)}</td><td class="r">${T.nb ? money(T.ca / T.nb) : 0}</td><td></td>${mode === 'annee' ? `<td class="r">${money(T.obj)}</td><td class="r">${T.obj ? pct(T.ca / T.obj * 100) : '—'}</td>` : ''}<td></td></tr></tfoot></table></div>
<p class="hint">« Évolution » compare le chiffre d'affaires avec la période précédente. Les ventes du siège sont ses factures aux agences. Les agences sans vente sont grisées.</p></div>
<div class="grid g2"><div class="card"><h2>Chiffre d'affaires par agence</h2><div style="position:relative;height:${Math.max(260, 34 * L.length)}px"><canvas id="ch1"></canvas></div></div>
<div class="card"><h2>Part de chaque agence dans le CA</h2><div style="position:relative;height:320px"><canvas id="ch2"></canvas></div></div></div>
<div class="card"><h2>Évolution mensuelle du chiffre d'affaires — ${anG}</h2><div style="position:relative;height:360px"><canvas id="ch3"></canvas></div><p class="hint">Les 6 meilleures agences de l'année sont affichées séparément ; les autres sont regroupées.</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
(function(){var m=document.getElementById('mode');function sync(){document.querySelectorAll('.m-an').forEach(function(x){x.style.display=m.value==='periode'?'none':'';});document.querySelectorAll('.m-mo').forEach(function(x){x.style.display=m.value==='mois'?'':'none';});document.querySelectorAll('.m-pe').forEach(function(x){x.style.display=m.value==='periode'?'':'none';});}m.onchange=sync;sync();
  if(!window.Chart)return;var L=${JSON.stringify(L.map(l => ({ ag: l.ag, ca: l.ca, enc: l.enc })))},M=${JSON.stringify(mens)},MAXM=${anG === Number(td.slice(0, 4)) ? Number(td.slice(5, 7)) : 12};
  var PAL=['#E07F16','#2E7D32','#1F4E8C','#B42318','#7C3AED','#0E9AA7','#8D6E63','#F7B32B','#546E7A','#C2185B','#558B2F','#5D4037'],money=function(v){return KFN.fmt(v)+' FCFA';};
  new Chart(document.getElementById('ch1'),{type:'bar',data:{labels:L.map(function(x){return x.ag;}),datasets:[{label:"Chiffre d'affaires",data:L.map(function(x){return x.ca;}),backgroundColor:L.map(function(x,i){return i?'#2E7D32':'#E07F16';})},{label:'Encaissé',data:L.map(function(x){return x.enc;}),backgroundColor:'#9CC9A0'}]},options:{indexAxis:'y',maintainAspectRatio:false,scales:{x:{ticks:{callback:function(v){return KFN.fmt(v);}}}},plugins:{tooltip:{callbacks:{label:function(c){return c.dataset.label+' : '+money(c.raw);}}}}}});
  var act=L.filter(function(x){return x.ca>0;});new Chart(document.getElementById('ch2'),{type:'doughnut',data:{labels:act.map(function(x){return x.ag;}),datasets:[{data:act.map(function(x){return x.ca;}),backgroundColor:PAL}]},options:{maintainAspectRatio:false,plugins:{legend:{position:window.innerWidth<600?'bottom':'right'}}}});
  var ags=Object.keys(M).sort(function(a,b){var s=function(k){return Object.keys(M[k]).reduce(function(x,y){return x+M[k][y];},0);};return s(b)-s(a);}),mois=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'],ds=[];
  ags.slice(0,6).forEach(function(a,i){ds.push({label:a,data:mois.map(function(_,k){return k<MAXM?(M[a][k+1]||0):null;}),borderColor:PAL[i],backgroundColor:PAL[i],tension:.2});});
  if(ags.length>6)ds.push({label:'Autres agences',data:mois.map(function(_,k){return k<MAXM?ags.slice(6).reduce(function(s,a){return s+(M[a][k+1]||0);},0):null;}),borderColor:'#999',backgroundColor:'#999',borderDash:[5,4],tension:.2});
  new Chart(document.getElementById('ch3'),{type:'line',data:{labels:mois,datasets:ds},options:{maintainAspectRatio:false,scales:{y:{min:0,ticks:{callback:function(v){return KFN.fmt(v);}}}},plugins:{tooltip:{callbacks:{label:function(c){return c.dataset.label+' : '+money(c.raw);}}}}}});})();
</script>`;
};
