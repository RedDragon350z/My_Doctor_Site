/* Pronto Click Dottore - Gestione consenso cookie
 * Inclusione: <script src="cookie-consent.js"></script> (nel <head>, prima degli altri script)
 * Riapertura preferenze: window.PCDCookies.open()  oppure link con data-cookie-settings
 * Script di terze parti da bloccare fino al consenso:
 *   <script type="text/plain" data-cookie-category="statistics" src="..."></script>
 *   <script type="text/plain" data-cookie-category="marketing"  src="..."></script>
 */
(function () {
  'use strict';
  var KEY = 'pcd_cookie_consent', VERSION = 1, MONTHS = 6;
  var POLICY_URL = 'cookie-policy.html'; // <-- cambia con la tua pagina di informativa cookie

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!c || c.v !== VERSION || Date.now() > c.exp) return null;
      return c;
    } catch (e) { return null; }
  }
  function save(stat, mkt) {
    var exp = new Date(); exp.setMonth(exp.getMonth() + MONTHS);
    var c = { v: VERSION, necessary: true, statistics: !!stat, marketing: !!mkt, exp: exp.getTime() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    activate(c);
    return c;
  }
  // Attiva gli script bloccati solo per le categorie consentite
  function activate(c) {
    document.querySelectorAll('script[type="text/plain"][data-cookie-category]').forEach(function (old) {
      if (!c[old.getAttribute('data-cookie-category')] || old.dataset.activated) return;
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) {
        if (a.name !== 'type' && a.name !== 'data-cookie-category') s.setAttribute(a.name, a.value);
      });
      s.text = old.text; old.dataset.activated = '1';
      old.parentNode.insertBefore(s, old.nextSibling);
    });
    document.dispatchEvent(new CustomEvent('pcd-cookie-consent', { detail: c }));
  }

  var css = '\
#pcd-ck,#pcd-ck-modal{--bg:#fff;--fg:#1e293b;--mut:#64748b;--bd:#e2e8f0;--br:#0284c7;--brh:#0369a1;font-family:Inter,system-ui,sans-serif;color:var(--fg)}\
html.dark #pcd-ck,html.dark #pcd-ck-modal{--bg:#0f172a;--fg:#e2e8f0;--mut:#94a3b8;--bd:#334155}\
#pcd-ck{position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;max-width:760px;margin:0 auto;background:var(--bg);border:1px solid var(--bd);border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.25);padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px))}\
#pcd-ck h2{margin:0 0 6px;font-size:16px;font-weight:700}\
#pcd-ck p{margin:0;font-size:13px;line-height:1.5;color:var(--mut)}\
#pcd-ck a,#pcd-ck-modal a{color:var(--br);font-weight:600;text-decoration:underline}\
.pcd-row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}\
.pcd-btn{flex:1 1 140px;padding:11px 14px;border-radius:12px;border:1.5px solid var(--br);background:var(--br);color:#fff;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;transition:background .15s}\
.pcd-btn:hover{background:var(--brh);border-color:var(--brh)}\
.pcd-btn:focus-visible,.pcd-sw:focus-visible{outline:3px solid #7dd3fc;outline-offset:2px}\
#pcd-ck-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.6);overflow-y:auto}\
.pcd-box{background:var(--bg);border:1px solid var(--bd);border-radius:16px;max-width:520px;width:100%;padding:20px;max-height:92vh;overflow-y:auto}\
.pcd-box h2{margin:0 0 4px;font-size:18px}\
.pcd-cat{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:12px 0;border-top:1px solid var(--bd)}\
.pcd-cat:first-of-type{margin-top:12px}\
.pcd-cat b{font-size:14px}.pcd-cat span{display:block;font-size:12px;color:var(--mut);margin-top:2px;line-height:1.45}\
.pcd-sw{appearance:none;-webkit-appearance:none;flex:none;width:44px;height:26px;border-radius:99px;background:#cbd5e1;position:relative;cursor:pointer;transition:background .15s;border:0}\
.pcd-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .15s}\
.pcd-sw:checked{background:var(--br)}.pcd-sw:checked::after{transform:translateX(18px)}\
.pcd-sw:disabled{opacity:.55;cursor:not-allowed}\
@media(prefers-reduced-motion:reduce){.pcd-btn,.pcd-sw,.pcd-sw::after{transition:none}}';

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function closeAll() { ['pcd-ck', 'pcd-ck-modal'].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); }); }

  function buttons(prefix) {
    return '<button type="button" class="pcd-btn" data-a="reject">Rifiuta</button>' +
           '<button type="button" class="pcd-btn" data-a="' + prefix + 'custom">Personalizza</button>' +
           '<button type="button" class="pcd-btn" data-a="accept">Accetta tutti</button>';
  }

  function showBanner() {
    closeAll();
    var b = el('<div id="pcd-ck" role="dialog" aria-modal="false" aria-labelledby="pcd-t">' +
      '<h2 id="pcd-t">Questo sito usa i cookie</h2>' +
      '<p>Usiamo cookie tecnici, necessari al funzionamento del sito (accesso e prenotazioni). Con il tuo consenso possiamo usare anche cookie statistici e di marketing. Puoi accettare, rifiutare o scegliere per categoria; puoi cambiare idea in ogni momento. ' +
      '<a href="' + POLICY_URL + '">Informativa cookie</a></p>' +
      '<div class="pcd-row">' + buttons('') + '</div></div>');
    b.addEventListener('click', onAction);
    document.body.appendChild(b);
  }

  function showModal() {
    closeAll();
    var c = read() || { statistics: false, marketing: false };
    var m = el('<div id="pcd-ck-modal" role="dialog" aria-modal="true" aria-labelledby="pcd-mt"><div class="pcd-box">' +
      '<h2 id="pcd-mt">Preferenze cookie</h2>' +
      '<p style="margin:0;font-size:13px;color:var(--mut)">Scegli quali categorie consentire. <a href="' + POLICY_URL + '">Informativa cookie</a></p>' +
      '<div class="pcd-cat"><label for="pcd-n"><b>Necessari</b><span>Indispensabili per login, prenotazioni, sicurezza e per ricordare questa scelta. Sempre attivi.</span></label><input id="pcd-n" class="pcd-sw" type="checkbox" checked disabled></div>' +
      '<div class="pcd-cat"><label for="pcd-s"><b>Statistiche</b><span>Ci aiutano a capire come viene usato il sito, in forma aggregata.</span></label><input id="pcd-s" class="pcd-sw" type="checkbox"' + (c.statistics ? ' checked' : '') + '></div>' +
      '<div class="pcd-cat"><label for="pcd-m"><b>Marketing</b><span>Servono a mostrare contenuti o annunci pertinenti.</span></label><input id="pcd-m" class="pcd-sw" type="checkbox"' + (c.marketing ? ' checked' : '') + '></div>' +
      '<div class="pcd-row"><button type="button" class="pcd-btn" data-a="reject">Rifiuta</button>' +
      '<button type="button" class="pcd-btn" data-a="savecustom">Salva scelte</button>' +
      '<button type="button" class="pcd-btn" data-a="accept">Accetta tutti</button></div></div></div>');
    m.addEventListener('click', onAction);
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape' && read()) closeAll(); });
    document.body.appendChild(m);
    m.querySelector('#pcd-s').focus();
  }

  function onAction(e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (!a) return;
    if (a === 'accept') { save(true, true); closeAll(); }
    else if (a === 'reject') { save(false, false); closeAll(); }
    else if (a === 'custom') showModal();
    else if (a === 'savecustom') {
      save(document.getElementById('pcd-s').checked, document.getElementById('pcd-m').checked); closeAll();
    }
  }

  window.PCDCookies = { open: showModal, get: read };

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.addEventListener('click', function (e) {
      var t = e.target instanceof Element && e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); showModal(); }
    });
    var c = read();
    if (c) activate(c); else showBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
