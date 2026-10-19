/* KFN PHARMA - Application de gestion */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var TOUCH = window.matchMedia('(pointer: coarse)').matches;
  var CSRF = (document.querySelector('meta[name=csrf]') || {}).content || '';

  var KFN = window.KFN = {};
  KFN.fmt = function (n, dec) {
    n = Number(n) || 0;
    if (typeof dec !== 'number') dec = null;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec }).replace(/\u202f/g, ' ');
  };
  KFN.num = function (v) { return Number(String(v == null ? '' : v).replace(/\s|\u202f|\u00a0/g, '').replace(',', '.')) || 0; };
  KFN.esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  KFN.get = function (url) {
    return fetch(url, { headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.href = '/gestion/login'; throw new Error('Session expirée'); }
      return r.json();
    });
  };
  KFN.post = function (url, data) {
    var fd = data instanceof FormData ? data : new FormData();
    if (!(data instanceof FormData)) Object.keys(data || {}).forEach(function (k) { fd.append(k, data[k]); });
    fd.append('_csrf', CSRF);
    return fetch(url, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  };
  KFN.toast = function (msg, type) {
    var t = document.createElement('div');
    t.className = 'flash ' + (type || 'ok');
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(1rem + env(safe-area-inset-bottom,0px));z-index:200;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);max-width:92vw';
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  };

  /* ---------- Questions et informations ---------- */
  KFN.MSG = {
    save: 'Voulez-vous valider l\u2019enregistrement ?',
    modify: 'Voulez-vous modifier cette opération ?',
    'delete': 'Voulez-vous supprimer ? Attention ! c\u2019est une action délicate, êtes-vous sûr ?'
  };
  function dialog(o) {
    return new Promise(function (resolve) {
      var m = document.createElement('div');
      m.className = 'modal';
      m.innerHTML = '<div class="modal__box dlg" role="' + (o.alert ? 'alertdialog' : 'dialog') + '" aria-modal="true">' +
        '<div class="dlg__ico ' + o.tone + '">' + o.icon + '</div><h3 class="dlg__t"></h3><p class="dlg__m"></p><div class="actions dlg__a"></div></div>';
      m.querySelector('.dlg__t').textContent = o.title;
      m.querySelector('.dlg__m').textContent = o.msg;
      var acts = m.querySelector('.dlg__a');
      o.buttons.forEach(function (b) { var x = document.createElement('button'); x.type = 'button'; x.className = 'btn ' + b[2]; x.textContent = b[0]; x.dataset.r = b[1]; acts.appendChild(x); });
      function done(v) { m.remove(); document.removeEventListener('keydown', key); resolve(v); }
      function key(e) { if (e.key === 'Escape') done(false); if (e.key === 'Enter' && o.alert) done(true); }
      m.addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (e.target === m && !o.alert) done(false); });
      document.addEventListener('keydown', key);
      document.body.appendChild(m);
      var f = m.querySelector('[data-r="1"]'); if (f) f.focus();
    });
  }
  /* KFN.confirm(message | 'save' | 'modify' | 'delete') -> Promise<bool> */
  KFN.confirm = function (msg, kind) {
    if (KFN.MSG[msg]) { kind = msg; msg = KFN.MSG[msg]; }
    kind = kind || 'save';
    var del = kind === 'delete';
    return dialog({ title: del ? 'Suppression' : (kind === 'modify' ? 'Modification' : 'Confirmation'), msg: msg || KFN.MSG.save,
      icon: del ? '!' : '?', tone: del ? 'r' : 'g',
      buttons: [['Non', '0', 'ghost'], [del ? 'Oui, supprimer' : 'Oui', '1', del ? 'red' : 'green']] });
  };
  /* Boîte d'information */
  KFN.alert = function (msg, title) {
    return dialog({ alert: true, title: title || 'Information', msg: msg, icon: 'i', tone: 'b', buttons: [['OK', '1', 'green']] });
  };

  /* ---------- Détail d'une ligne d'état (facture, client, produit, appro) ---------- */
  KFN.details = function (qs) {
    var m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = '<div class="modal__box" role="dialog" aria-modal="true" style="background:#fff;width:min(1000px,100%)"><div class="modal__head"><h3>Chargement…</h3>' +
      '<a class="btn sm" target="_blank" hidden data-print-link>Imprimer</a><button class="btn green sm" data-close>Fermer</button></div><div class="modal__body"></div></div>';
    function close() { m.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    m.querySelector('[data-close]').onclick = close;
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.body.appendChild(m);
    var body = m.querySelector('.modal__body');
    KFN.get('/gestion/api?a=details&' + qs).then(function (d) {
      if (d.error) { m.querySelector('h3').textContent = 'Détail'; body.innerHTML = '<p class="flash err">' + KFN.esc(d.error) + '</p>'; return; }
      m.querySelector('h3').textContent = d.titre;
      if (d.imprimer) { var pl = m.querySelector('[data-print-link]'); pl.href = d.imprimer; pl.hidden = false; }
      var h = d.sousTitre ? '<p class="hint" style="margin-top:0">' + KFN.esc(d.sousTitre) + '</p>' : '';
      if (d.resume) h += '<div class="kpis">' + d.resume.map(function (x) { return '<div class="kpi"><small>' + KFN.esc(x[0]) + '</small><b>' + KFN.fmt(x[1]) + '</b></div>'; }).join('') + '</div>';
      d.sections.forEach(function (s, si) {
        h += '<h2 style="margin-top:1rem">' + KFN.esc(s.titre) + '</h2><div class="tbl-wrap" style="max-height:45vh"><table class="tbl grey"><thead><tr>' +
          s.cols.map(function (c, i) { return '<th class="' + (s.num.indexOf(i) >= 0 ? 'r' : '') + '">' + KFN.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          (s.rows.length ? s.rows.map(function (r) {
            return '<tr' + (s.lien ? ' class="click" data-sub="' + si + '"' : '') + '>' + r.map(function (v, i) { return '<td class="' + (s.num.indexOf(i) >= 0 ? 'r' : '') + '">' + (s.num.indexOf(i) >= 0 ? KFN.fmt(v) : KFN.esc(v)) + '</td>'; }).join('') + '</tr>';
          }).join('') : '<tr><td class="empty" colspan="' + s.cols.length + '">Aucune donnée.</td></tr>') + '</tbody></table></div>';
      });
      body.innerHTML = h;
      body.querySelectorAll('tr[data-sub]').forEach(function (tr) {
        tr.addEventListener('click', function () {
          var s = d.sections[+tr.dataset.sub], v = tr.cells[s.lien.col].textContent;
          KFN.details('type=' + s.lien.type + '&' + s.lien.key + '=' + encodeURIComponent(v));
        });
      });
    }).catch(function () { body.innerHTML = '<p class="flash err">Chargement impossible.</p>'; });
  };

  /* ---------- Fenêtre de choix (pop-up) ----------
     KFN.pick({title, url|data, cols:[{k,label,cls,fmt}], onPick(row)}) */
  KFN.pick = function (o) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="modal__box" role="dialog" aria-modal="true"><div class="modal__head"><h3></h3>' +
      '<button class="btn green sm" data-close>Fermer</button></div><div class="modal__body">' +
      '<input type="search" placeholder="Rechercher…" style="margin-bottom:.7rem" aria-label="Rechercher">' +
      '<div class="tbl-wrap"><table class="tbl grey"><thead><tr></tr></thead><tbody><tr><td class="empty">Chargement…</td></tr></tbody></table></div>' +
      '<p class="hint" style="margin:.6rem 0 0">' + (TOUCH ? 'Touchez une ligne pour la choisir.' : 'Double-cliquez sur une ligne pour la choisir.') + '</p></div></div>';
    $('h3', m).textContent = o.title || 'Choisir';
    var thr = $('thead tr', m), tb = $('tbody', m), search = $('input', m), data = [];
    o.cols.forEach(function (c) { var th = document.createElement('th'); th.textContent = c.label; if (c.cls) th.className = c.cls; thr.appendChild(th); });
    function close() { m.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    $('[data-close]', m).addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    function render() {
      var f = search.value.trim().toLowerCase(); tb.innerHTML = ''; var n = 0;
      data.forEach(function (r) {
        if (f && JSON.stringify(r).toLowerCase().indexOf(f) < 0) return;
        if (++n > 400) return;
        var tr = document.createElement('tr'); tr.className = 'click';
        o.cols.forEach(function (c) {
          var td = document.createElement('td'); if (c.cls) td.className = c.cls;
          var v = r[c.k]; td.textContent = c.fmt ? c.fmt(v, r) : (v == null ? '' : v); tr.appendChild(td);
        });
        var choose = function () { close(); o.onPick(r); };
        tr.addEventListener('click', function () { $$('tr.sel', tb).forEach(function (x) { x.classList.remove('sel'); }); tr.classList.add('sel'); if (TOUCH) choose(); });
        tr.addEventListener('dblclick', choose);
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') choose(); });
        tr.tabIndex = 0;
        tb.appendChild(tr);
      });
      if (!n) tb.innerHTML = '<tr><td class="empty" colspan="' + o.cols.length + '">' + (o.empty || 'Aucun élément.') + '</td></tr>';
    }
    search.addEventListener('input', render);
    document.body.appendChild(m);
    setTimeout(function () { if (!TOUCH) search.focus(); }, 30);
    (o.data ? Promise.resolve(o.data) : KFN.get(o.url)).then(function (d) {
      if (d && d.error) { tb.innerHTML = '<tr><td class="empty">' + KFN.esc(d.error) + '</td></tr>'; return; }
      data = d || []; render();
    }).catch(function () { tb.innerHTML = '<tr><td class="empty">Chargement impossible. Vérifiez la connexion.</td></tr>'; });
  };

  /* ---------- Grille de lignes ----------
     new KFN.Lines(tableEl, {cols:[{k,label,cls,fmt,edit:true,max:'k'}], input: hiddenInput, onChange}) */
  KFN.Lines = function (table, o) {
    var self = this; self.rows = []; self.sel = -1;
    var tb = table.tBodies[0] || table.appendChild(document.createElement('tbody'));
    var th0 = table.tHead || table.createTHead(); var thr = th0.rows[0] || th0.insertRow();
    if (!thr.cells.length) o.cols.forEach(function (c) { var th = document.createElement('th'); th.textContent = c.label; if (c.cls) th.className = c.cls; thr.appendChild(th); });
    self.render = function () {
      tb.innerHTML = '';
      if (!self.rows.length) tb.innerHTML = '<tr><td class="empty" colspan="' + o.cols.length + '">' + (o.empty || 'Aucune ligne. Ajoutez des articles.') + '</td></tr>';
      self.rows.forEach(function (r, i) {
        var tr = document.createElement('tr'); tr.className = 'click' + (i === self.sel ? ' sel' : '');
        o.cols.forEach(function (c) {
          var td = document.createElement('td'); if (c.cls) td.className = c.cls;
          if (c.edit) {
            td.className += ' edit';
            var inp = document.createElement('input'); inp.type = c.type || 'number'; inp.step = 'any'; inp.min = 0; inp.inputMode = 'decimal';
            inp.value = r[c.k]; inp.setAttribute('aria-label', c.label);
            inp.addEventListener('input', function () {
              var v = KFN.num(inp.value);
              if (c.max && v > KFN.num(r[c.max])) { v = KFN.num(r[c.max]); inp.value = v; KFN.toast('Quantité limitée à ' + KFN.fmt(v), 'info'); }
              r[c.k] = v; if (o.recalc) o.recalc(r);
              o.cols.forEach(function (cc, j) {
                if (cc.edit || cc.check) return;
                var cell = tr.cells[j], val = r[cc.k];
                if (cell) cell.textContent = cc.fmt ? cc.fmt(val, r) : (val == null ? '' : val);
              });
              self.sync(true);
            });
            td.appendChild(inp);
          } else if (c.check) {
            td.className += ' c';
            var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!r[c.k];
            cb.addEventListener('change', function () { r[c.k] = cb.checked ? 1 : 0; self.sync(true); });
            td.appendChild(cb);
          } else {
            var v = r[c.k]; td.textContent = c.fmt ? c.fmt(v, r) : (v == null ? '' : v);
          }
          tr.appendChild(td);
        });
        tr.addEventListener('click', function (e) {
          if (e.target.tagName === 'INPUT') return;
          self.sel = (self.sel === i ? -1 : i); self.render();
        });
        tb.appendChild(tr);
      });
      self.sync();
    };
    self.sync = function (soft) {
      if (o.input) o.input.value = JSON.stringify(self.rows);
      if (o.onChange) o.onChange(self.rows);
      if (soft) { /* pas de re-rendu pour garder le focus */ }
    };
    self.add = function (r) {
      if (o.key) {
        var ex = self.rows.findIndex(function (x) { return x[o.key] === r[o.key]; });
        if (ex >= 0) { if (o.merge) o.merge(self.rows[ex], r); else self.rows[ex] = r; self.render(); return; }
      }
      self.rows.push(r); self.render();
    };
    self.set = function (rows) { self.rows = rows || []; self.sel = -1; self.render(); };
    self.removeSelected = function () {
      if (self.sel < 0) { KFN.toast('Sélectionnez d’abord une ligne dans le tableau.', 'info'); return; }
      self.rows.splice(self.sel, 1); self.sel = -1; self.render();
    };
    self.selected = function () { return self.sel >= 0 ? self.rows[self.sel] : null; };
    self.render();
  };

  /* ---------- Comportements génériques ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    // Menu latéral : groupes repliables, menu réduit, menu mobile, menu utilisateur
    $$('.sb-tog').forEach(function (b) {
      b.addEventListener('click', function () {
        if (document.documentElement.classList.contains('sb-mini') && window.innerWidth > 980) { document.documentElement.classList.remove('sb-mini'); try { localStorage.setItem('kfn-sb', '0'); } catch (e) {} }
        var g = b.parentNode, o = !g.classList.contains('open'); g.classList.toggle('open', o); b.setAttribute('aria-expanded', o);
      });
    });
    var col = $('#sbcol'); if (col) col.addEventListener('click', function () { var m = document.documentElement.classList.toggle('sb-mini'); try { localStorage.setItem('kfn-sb', m ? '1' : '0'); } catch (e) {} });
    var sb = $('#sb'), veil = $('#sbveil'), op = $('#sbopen');
    function sbClose() { sb.classList.remove('open'); veil.classList.remove('open'); }
    if (op) op.addEventListener('click', function () { sb.classList.add('open'); veil.classList.add('open'); });
    if (veil) veil.addEventListener('click', sbClose);
    var av = $('#avbtn'), avm = $('#avmenu');
    if (av) { av.addEventListener('click', function (e) { e.stopPropagation(); avm.hidden = !avm.hidden; av.setAttribute('aria-expanded', !avm.hidden); });
      document.addEventListener('click', function (e) { if (!e.target.closest('.tb-user')) avm.hidden = true; }); }
    // menu mobile
    var nav = $('.app-nav'), burger = $('.burger');
    if (burger) burger.addEventListener('click', function () { nav.classList.add('open'); });
    if (nav) nav.addEventListener('click', function (e) { if (e.target === nav) nav.classList.remove('open'); });
    $$('.nav-item>button').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = b.parentNode, open = !it.classList.contains('open');
        $$('.nav-item').forEach(function (x) { x.classList.remove('open'); });
        it.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item') && window.innerWidth > 980) $$('.nav-item').forEach(function (x) { x.classList.remove('open'); });
    });
    // soumission auto
    $$('[data-autosubmit]').forEach(function (el) { el.addEventListener('change', function () { el.form.submit(); }); });
    // filtre de tableau
    $$('[data-filter]').forEach(function (inp) {
      var t = $(inp.dataset.filter);
      inp.addEventListener('input', function () {
        var f = inp.value.trim().toLowerCase();
        $$('tbody tr', t).forEach(function (tr) { tr.style.display = !f || tr.textContent.toLowerCase().indexOf(f) >= 0 ? '' : 'none'; });
      });
    });
    // impression
    $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
    // export CSV
    $$('[data-export]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = $(b.dataset.export), lines = [];
        $$('tr', t).forEach(function (tr) {
          if (tr.style.display === 'none') return;
          lines.push($$('th,td', tr).map(function (c) { return '"' + c.textContent.trim().replace(/"/g, '""') + '"'; }).join(';'));
        });
        var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (b.dataset.name || 'export') + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
      });
    });
    // Confirmation avant chaque enregistrement + un seul envoi
    $$('form').forEach(function (f) {
      if ((f.getAttribute('method') || 'get').toLowerCase() !== 'post') return;
      f.addEventListener('submit', function (e) {
        if (e.defaultPrevented) return;
        if (f.dataset.ok) {
          delete f.dataset.ok;
          if (f.dataset.sent) { e.preventDefault(); return; }
          f.dataset.sent = 1; setTimeout(function () { delete f.dataset.sent; }, 4000);
          return;
        }
        e.preventDefault();
        var sub = e.submitter;
        var c = (sub && sub.dataset.confirm) || f.dataset.confirm || 'save';
        var kind = KFN.MSG[c] ? c : ((sub && sub.dataset.kind) || f.dataset.kind || 'save');
        KFN.confirm(KFN.MSG[c] || c, kind).then(function (ok) {
          if (!ok) { KFN.toast('Retour : aucune action effectuée.', 'info'); return; }
          var k = f.querySelector('input[name="_kind"]');
          if (!k) { k = document.createElement('input'); k.type = 'hidden'; k.name = '_kind'; f.appendChild(k); }
          k.value = kind;
          f.dataset.ok = 1;
          if (f.requestSubmit) f.requestSubmit(sub && sub.form === f ? sub : undefined); else f.submit();
        });
      });
    });
    // Notifications des pré-commandes : actualisation toutes les 60 s
    var main = $('main.main');
    if (main && main.dataset.notif !== undefined) {
      var prev = main.dataset.notif.split(',').map(Number);
      setInterval(function () {
        KFN.get('/gestion/api?a=notifs').then(function (n) {
          if (!n || n.error) return;
          var bell = $('#nbell');
          if (bell) { bell.textContent = n.bleu + n.rouge; bell.hidden = !(n.bleu + n.rouge); bell.className = n.rouge ? 'r' : ''; }
          if (n.bleu > prev[0] && n.nouveaux.length) KFN.toast('✉ ' + n.nouveaux[0].titre, 'info');
          prev = [n.bleu, n.rouge];
        }).catch(function () {});
      }, 60000);
    }
    // lignes cliquables (lien)
    $$('tr[data-href]').forEach(function (tr) { tr.classList.add('click'); tr.addEventListener('click', function () { location.href = tr.dataset.href; }); });
  });
})();
