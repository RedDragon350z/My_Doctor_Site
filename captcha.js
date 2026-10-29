/*
 * Pronto Click Dottore - Verifica di sicurezza (Cloudflare Turnstile)
 *
 * API usata dalle pagine:
 *   PCDCaptcha.render(id)      mostra il captcha dentro l'elemento con quell'id
 *   PCDCaptcha.getToken(id)    restituisce il token ('' se non ancora completato)
 *   PCDCaptcha.reset(id)       azzera il captcha (dopo un errore)
 *   PCDCaptcha.isConfigured()  true se nella pagina c'è la meta "captcha-site-key"
 *
 * Tutti gli elementi con attributo data-captcha e un id vengono mostrati in automatico.
 * NOTA: non usa turnstile.ready(), che dà errore quando lo script è caricato in modo
 * asincrono ("Remove async/defer from the Turnstile api.js script tag...").
 */
(function () {
    'use strict';

    var API_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    var meta = document.querySelector('meta[name="captcha-site-key"]');
    var siteKey = meta ? (meta.getAttribute('content') || '').trim() : '';
    var widgets = {};   // id -> { el, widgetId, token }
    var apiPromise = null;

    function loadApi() {
        if (window.turnstile) return Promise.resolve();
        if (apiPromise) return apiPromise;
        apiPromise = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = API_URL;
            s.onload = function () {
                if (window.turnstile) resolve();
                else reject(new Error('Turnstile non disponibile'));
            };
            s.onerror = function () {
                apiPromise = null;   // permette un nuovo tentativo
                reject(new Error('Impossibile caricare Turnstile'));
            };
            document.head.appendChild(s);
        });
        return apiPromise;
    }

    function showMessage(el, text) {
        if (!el) return;
        el.innerHTML = '<p style="font-size:12px;color:#b91c1c;text-align:center;">' + text + '</p>';
    }

    function render(id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!siteKey) {
            showMessage(el, 'Verifica di sicurezza non configurata.');
            return;
        }
        // già mostrato su questo stesso elemento
        if (widgets[id] && widgets[id].el === el && el.childNodes.length) return;

        var entry = { el: el, widgetId: null, token: '' };
        widgets[id] = entry;

        loadApi().then(function () {
            if (!document.body.contains(el) || widgets[id] !== entry) return;   // elemento rimosso nel frattempo
            el.innerHTML = '';
            entry.widgetId = window.turnstile.render(el, {
                sitekey: siteKey,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                callback: function (token) { entry.token = token; },
                'expired-callback': function () { entry.token = ''; },
                'timeout-callback': function () { entry.token = ''; },
                'error-callback': function () { entry.token = ''; }
            });
        }).catch(function () {
            showMessage(el, 'Impossibile caricare la verifica di sicurezza. Controlla la connessione o disattiva il blocco dei contenuti e ricarica la pagina.');
        });
    }

    function getToken(id) {
        var entry = widgets[id];
        if (!entry) return '';
        if (entry.token) return entry.token;
        if (window.turnstile && entry.widgetId !== null) {
            try { return window.turnstile.getResponse(entry.widgetId) || ''; } catch (e) { /* ignora */ }
        }
        return '';
    }

    function reset(id) {
        var entry = widgets[id];
        if (!entry) return;
        entry.token = '';
        if (window.turnstile && entry.widgetId !== null) {
            try { window.turnstile.reset(entry.widgetId); } catch (e) { /* ignora */ }
        }
    }

    function renderAll() {
        document.querySelectorAll('[data-captcha]').forEach(function (el) {
            if (el.id) render(el.id);
        });
    }

    window.PCDCaptcha = {
        render: render,
        getToken: getToken,
        reset: reset,
        isConfigured: function () { return !!siteKey; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAll);
    else renderAll();
})();
