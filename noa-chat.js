/*
 * Pronto Click Dottore - Noa IA (chat flottante)
 *
 * Uso: aggiungi in fondo a ogni pagina (prima di </body>):
 *     <script src="noa-chat.js" defer></script>
 *
 * Legge dalle meta della pagina "supabase-url" e "supabase-key" (le stesse che usi già)
 * e chiama la funzione "noa-chat". Supporta il tema scuro (classe "dark" su <html>).
 */
(function () {
    'use strict';

    function meta(name) {
        var m = document.querySelector('meta[name="' + name + '"]');
        return m ? (m.getAttribute('content') || '').trim() : '';
    }
    var SUPABASE_URL = meta('supabase-url');
    var SUPABASE_KEY = meta('supabase-key');
    if (!SUPABASE_URL) return;
    var ENDPOINT = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/noa-chat';

    var STORE = 'pcd-noa-chat';
    var MAX_SENT = 20;
    var history = [];
    var busy = false;

    try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]') || []; } catch (e) { history = []; }
    function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_SENT))); } catch (e) {} }

    /* ---------- Stile ---------- */
    var css = '\
#noa-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:flex;align-items:center;gap:8px;border:0;cursor:pointer;\
background:#0284c7;color:#fff;font:600 14px Inter,system-ui,sans-serif;padding:12px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(2,132,199,.35);transition:background .2s}\
#noa-fab:hover{background:#0369a1}\
#noa-fab:focus-visible,#noa-send:focus-visible,#noa-close:focus-visible,#noa-input:focus-visible,.noa-chip:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}\
#noa-panel{position:fixed;right:20px;bottom:20px;z-index:9999;width:380px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 40px);\
display:none;flex-direction:column;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.25);overflow:hidden;font-family:Inter,system-ui,sans-serif}\
#noa-panel.open{display:flex}\
#noa-head{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#0284c7;color:#fff}\
#noa-head b{font-size:15px;font-weight:700;display:block;line-height:1.2}\
#noa-head small{font-size:11px;opacity:.85}\
#noa-close{margin-left:auto;background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}\
#noa-close:hover{background:rgba(255,255,255,.18)}\
#noa-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}\
.noa-msg{max-width:88%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}\
.noa-bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px}\
.noa-user{align-self:flex-end;background:#0284c7;color:#fff;border-bottom-right-radius:4px}\
.noa-err{align-self:flex-start;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}\
.noa-typing{align-self:flex-start;color:#64748b;font-size:13px;padding:4px 6px}\
#noa-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}\
.noa-chip{border:1px solid #bae6fd;background:#f0f9ff;color:#0369a1;font:500 12.5px Inter,system-ui,sans-serif;padding:7px 11px;border-radius:999px;cursor:pointer}\
.noa-chip:hover{background:#e0f2fe}\
#noa-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}\
#noa-input{flex:1;resize:none;border:1px solid #e2e8f0;border-radius:12px;padding:9px 12px;font:400 16px Inter,system-ui,sans-serif;max-height:96px;background:#f8fafc;color:#0f172a}\
#noa-send{border:0;cursor:pointer;background:#0284c7;color:#fff;font:600 14px Inter,system-ui,sans-serif;padding:0 16px;border-radius:12px}\
#noa-send:hover{background:#0369a1}\
#noa-send:disabled{opacity:.55;cursor:not-allowed}\
#noa-note{font-size:10.5px;color:#64748b;text-align:center;padding:0 12px 8px;background:#fff}\
@media (max-width:480px){#noa-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}#noa-fab{right:14px;bottom:14px}}\
html.dark #noa-panel{background:#111b2f;color:#e2e8f0;border-color:#25324d}\
html.dark #noa-head{background:#0c4a6e}\
html.dark #noa-log{background:#0b1220}\
html.dark .noa-bot{background:#162239;border-color:#25324d;color:#e2e8f0}\
html.dark .noa-user{background:#0369a1}\
html.dark .noa-err{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.35);color:#fca5a5}\
html.dark .noa-typing,html.dark #noa-note{color:#94a3b8}\
html.dark .noa-chip{background:rgba(56,189,248,.10);border-color:rgba(56,189,248,.35);color:#7dd3fc}\
html.dark #noa-form,html.dark #noa-note{background:#111b2f;border-color:#25324d}\
html.dark #noa-input{background:#0b1220;border-color:#25324d;color:#e2e8f0}\
@media (prefers-reduced-motion:reduce){#noa-fab{transition:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    /* ---------- Struttura ---------- */
    function el(tag, attrs, text) {
        var n = document.createElement(tag);
        if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
        if (text) n.textContent = text;
        return n;
    }

    var fab = el('button', { id: 'noa-fab', type: 'button', 'aria-label': 'Apri la chat con Noa' }, 'Chiedi a Noa');
    var panel = el('div', { id: 'noa-panel', role: 'dialog', 'aria-label': 'Chat con Noa' });

    var head = el('div', { id: 'noa-head' });
    var title = el('div');
    title.appendChild(el('b', null, 'Noa'));
    title.appendChild(el('small', null, 'Assistente di Pronto Click Dottore'));
    var closeBtn = el('button', { id: 'noa-close', type: 'button', 'aria-label': 'Chiudi la chat' }, '\u00d7');
    head.appendChild(title);
    head.appendChild(closeBtn);

    var log = el('div', { id: 'noa-log', 'aria-live': 'polite' });

    var form = el('form', { id: 'noa-form' });
    var input = el('textarea', { id: 'noa-input', rows: '1', maxlength: '2000', placeholder: 'Scrivi un messaggio\u2026', 'aria-label': 'Messaggio' });
    var send = el('button', { id: 'noa-send', type: 'submit' }, 'Invia');
    form.appendChild(input);
    form.appendChild(send);

    var note = el('div', { id: 'noa-note' }, 'Noa fornisce informazioni generali e non sostituisce il medico. In caso di emergenza chiama il 112.');

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(note);
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    /* ---------- Funzioni ---------- */
    function addMsg(text, cls) {
        var m = el('div', { 'class': 'noa-msg ' + cls }, text);
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
        return m;
    }

    function showWelcome() {
        addMsg('Ciao, sono Noa. Posso aiutarti a usare il sito e rispondere a domande su salute e benessere. Come posso aiutarti?', 'noa-bot');
        var chips = el('div', { id: 'noa-chips' });
        ['Come mi registro come paziente?', 'Consigli per dormire meglio', 'Come mi preparo a una visita?'].forEach(function (q) {
            var c = el('button', { type: 'button', 'class': 'noa-chip' }, q);
            c.addEventListener('click', function () { ask(q); });
            chips.appendChild(c);
        });
        log.appendChild(chips);
    }

    function restore() {
        log.innerHTML = '';
        if (!history.length) { showWelcome(); return; }
        history.forEach(function (m) { addMsg(m.content, m.role === 'user' ? 'noa-user' : 'noa-bot'); });
    }

    function getAuthToken() {
        try {
            if (window.supabase && window.supabase.auth) {
                return window.supabase.auth.getSession().then(function (r) {
                    return (r && r.data && r.data.session && r.data.session.access_token) || SUPABASE_KEY;
                }).catch(function () { return SUPABASE_KEY; });
            }
        } catch (e) { /* ignora */ }
        return Promise.resolve(SUPABASE_KEY);
    }

    function ask(text) {
        text = (text || '').trim();
        if (!text || busy) return;
        busy = true;
        send.disabled = true;
        var chips = document.getElementById('noa-chips');
        if (chips) chips.remove();

        history.push({ role: 'user', content: text });
        addMsg(text, 'noa-user');
        input.value = '';
        input.style.height = 'auto';
        var typing = el('div', { 'class': 'noa-typing' }, 'Noa sta scrivendo\u2026');
        log.appendChild(typing);
        log.scrollTop = log.scrollHeight;

        getAuthToken().then(function (token) {
            return fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ messages: history.slice(-MAX_SENT) })
            });
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok || !data.reply) throw new Error(data.error || 'Noa non ha risposto. Riprova.');
                return data.reply;
            });
        }).then(function (reply) {
            typing.remove();
            history.push({ role: 'assistant', content: reply });
            addMsg(reply, 'noa-bot');
            persist();
        }).catch(function (err) {
            typing.remove();
            history.pop();   // toglie la domanda non risolta, così si può riprovare
            addMsg(err && err.message ? err.message : 'Errore di connessione. Riprova.', 'noa-err');
        }).then(function () {
            busy = false;
            send.disabled = false;
            input.focus();
        });
    }

    function open() {
        panel.classList.add('open');
        fab.style.display = 'none';
        if (!log.childNodes.length) restore();
        input.focus();
    }
    function close() {
        panel.classList.remove('open');
        fab.style.display = '';
        fab.focus();
    }

    fab.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });
})();
