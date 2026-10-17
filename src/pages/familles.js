'use strict';
/* Familles d'articles : un clic sur une ligne place la famille dans le champ, pour la modifier ou la supprimer.
   Modifier : personnes configurées au SIÈGE. Supprimer : SUPER ADMIN uniquement. */
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Familles articles';
  const peutModifier = ctx.estSiege(), peutSupprimer = ctx.isSuper();
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0, act = ctx.post('act');
    if (act === 'supprimer') {
      if (!peutSupprimer) { ctx.flash('Seul le Super Admin peut supprimer une famille.', 'err'); ctx.redirect('?p=familles'); }
      const f = await C.row('SELECT * FROM t_famille WHERE idt_famille = ?', [id]);
      if (!f) ctx.flash('Famille introuvable.', 'err');
      else if (Number(await C.val('SELECT COUNT(*) FROM t_articles WHERE libellefa = ?', [f.libellefa]))) ctx.flash(`La famille « ${f.libellefa} » contient des articles : suppression impossible.`, 'err');
      else { await C.q('DELETE FROM t_famille WHERE idt_famille = ?', [f.idt_famille]); ctx.flash(`Famille « ${f.libellefa} » supprimée.`); }
      ctx.redirect('?p=familles');
    }
    const lib = ctx.post('libelle').toUpperCase();
    if (!lib) ctx.flash('Saisissez le nom de la famille.', 'err');
    else if (Number(await C.val('SELECT COUNT(*) FROM t_famille WHERE libellefa = ? AND idt_famille <> ?', [lib, id]))) ctx.flash('Cette famille existe déjà.', 'err');
    else if (id) {
      if (!peutModifier) { ctx.flash('Seules les personnes configurées au siège peuvent modifier une famille.', 'err'); ctx.redirect('?p=familles'); }
      await C.tx(async () => {
        const old = await C.val('SELECT libellefa FROM t_famille WHERE idt_famille = ?', [id]);
        await C.q('UPDATE t_famille SET libellefa = ? WHERE idt_famille = ?', [lib, id]);
        await C.q('UPDATE t_articles SET libellefa = ? WHERE libellefa = ?', [lib, old]);
        await C.q('UPDATE t_stock SET familearticle = ? WHERE familearticle = ?', [lib, old]);
      });
      ctx.flash(`Famille renommée en « ${lib} » (articles et stocks mis à jour).`);
    } else { await C.q('INSERT INTO t_famille (libellefa, numero) VALUES (?, (SELECT COALESCE(MAX(numero),0)+1 FROM t_famille))', [lib]); ctx.flash(`Famille « ${lib} » enregistrée.`); }
    ctx.redirect('?p=familles');
  }
  const list = await C.rows('SELECT f.*, (SELECT COUNT(*) FROM t_articles a WHERE a.libellefa = f.libellefa) AS nb FROM t_famille f ORDER BY libellefa');
  return `<h1 class="page-title">Enregistrement famille articles</h1>
<div class="card"><form method="post" class="row" id="ff">${ctx.csrfField()}<input type="hidden" name="id" id="fid" value="0"><input type="hidden" name="act" id="fact" value="">
  <div class="f"><label for="lib">Famille article</label><input id="lib" name="libelle" required autocomplete="off"></div>
  <button class="btn" id="bval">Valider</button>
  ${peutModifier ? '<button class="btn green" id="bmod" data-confirm="modify" hidden>Modifier</button>' : ''}
  ${peutSupprimer ? '<button class="btn red" id="bsup" data-confirm="delete" formnovalidate hidden>Supprimer</button>' : ''}
  <button type="button" class="btn ghost" id="bnew" hidden>Nouvelle famille</button></form>
  <p class="hint" id="finfo">Cliquez sur une famille de la liste : son nom se place dans le champ pour la modifier${peutSupprimer ? ' ou la supprimer' : ''}.</p></div>
<h1 class="page-title">Listes des familles articles</h1>
<div class="card"><div class="row" style="margin-bottom:.7rem"><div class="f"><input placeholder="Rechercher une famille…" data-filter="#tf"></div></div>
<div class="tbl-wrap"><table class="tbl grey" id="tf"><thead><tr><th>Numéro</th><th>Nom de la famille</th><th class="r">Articles</th><th></th></tr></thead><tbody>
${list.map(f => `<tr class="click" data-id="${f.idt_famille}" data-lib="${e(f.libellefa)}" data-nb="${f.nb}"><td>${f.numero}</td><td><b>${e(f.libellefa)}</b></td><td class="r">${f.nb}</td>
  <td class="r" style="white-space:nowrap">${peutModifier ? '<button type="button" class="btn sm" data-a="mod">Modifier</button>' : ''} ${peutSupprimer ? `<button type="button" class="btn sm red" data-a="sup"${Number(f.nb) ? ' disabled title="Famille utilisée par des articles"' : ''}>Supprimer</button>` : ''}</td></tr>`).join('')}
</tbody></table></div>
<p class="hint">Modifier : personnes configurées au siège. Supprimer : Super Admin uniquement (et seulement si la famille ne contient aucun article).</p></div>
<script>
(function(){function v(id){return document.getElementById(id);}var cur=null;
  function choisir(tr){document.querySelectorAll('#tf tr.sel').forEach(function(x){x.classList.remove('sel');});tr.classList.add('sel');cur=tr;
    v('fid').value=tr.dataset.id;v('lib').value=tr.dataset.lib;v('bval').hidden=true;v('bnew').hidden=false;
    if(v('bmod'))v('bmod').hidden=false;if(v('bsup')){v('bsup').hidden=false;v('bsup').disabled=tr.dataset.nb!=='0';}
    v('finfo').innerHTML='Famille sélectionnée : <b>'+KFN.esc(tr.dataset.lib)+'</b>'+(tr.dataset.nb!=='0'?' ('+tr.dataset.nb+' article(s) : suppression impossible)':'');v('lib').focus();}
  document.querySelectorAll('#tf tbody tr').forEach(function(tr){tr.addEventListener('click',function(e){choisir(tr);var b=e.target.closest('[data-a]');
    if(b&&b.dataset.a==='sup'&&v('bsup')){v('bsup').click();}});});
  if(v('bmod'))v('bmod').addEventListener('click',function(){v('fact').value='modifier';});
  if(v('bsup'))v('bsup').addEventListener('click',function(){v('fact').value='supprimer';});
  v('bnew').onclick=function(){v('fid').value=0;v('lib').value='';v('bval').hidden=false;v('bnew').hidden=true;if(v('bmod'))v('bmod').hidden=true;if(v('bsup'))v('bsup').hidden=true;
    document.querySelectorAll('#tf tr.sel').forEach(function(x){x.classList.remove('sel');});v('finfo').textContent='Saisissez le nom de la nouvelle famille.';v('lib').focus();};
})();
</script>`;
};
