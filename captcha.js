/*
 * Verifica anti-bot (Cloudflare Turnstile) per Pronto Click Dottore.
 * La Site key (pubblica) si inserisce nel meta tag <meta name="captcha-site-key"> di ogni pagina.
 * La Secret key NON va mai messa nelle pagine: va solo nelle impostazioni CAPTCHA di Supabase.
 *
 * Uso:
 *  - un elemento con l'attributo data-captcha e un id viene disegnato in automatico
 *  - PCDCaptcha.render(id)    disegna il widget (utile per finestre create da script)
 *  - PCDCaptcha.getToken(id)  restituisce il codice da passare a Supabase (captchaToken)
 *  - PCDCaptcha.reset(id)     da chiamare dopo ogni tentativo: il codice vale una sola volta
 */
(function () {
    'use strict';

    var meta = function (name) {
        var el = document.querySelector('meta[name="' + name + '"]');
        return el ? (el.getAttribute('content') || '').trim() : '';
    };

    var SITE_KEY = meta('captcha-site-key');
    var configured = /^[0-9A-Za-z_-]{10,}$/.test(SITE_KEY) && !/INSERISCI/i.test(SITE_KEY);
    var widgets = {};          // id contenitore -> { id, token }
    var apiPromise = null;

    function loadApi() {
        if (window.turnstile && typeof window.turnstile.render === 'function') return Promise.resolve(window.turnstile);
        if (apiPromise) return apiPromise;
        apiPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = function () {
                if (!window.turnstile) { apiPromise = null; reject(new Error('Verifica di sicurezza non disponibile.')); return; }
                if (typeof window.turnstile.ready === 'function') window.turnstile.ready(function () { resolve(window.turnstile); });
                else resolve(window.turnstile);
            };
            script.onerror = function () {
                apiPromise = null;
                reject(new Error('Impossibile caricare la verifica di sicurezza. Controlla la connessione e ricarica la pagina.'));
            };
            document.head.appendChild(script);
        });
        return apiPromise;
    }

    function showNote(el, text) {
        el.textContent = '';
        var p = document.createElement('p');
        p.className = 'text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center';
        p.textContent = text;
        el.appendChild(p);
    }

    function render(containerId, options) {
        options = options || {};
        var el = document.getElementById(containerId);
        if (!el) return Promise.resolve(null);

        if (!configured) {
            console.warn('PCDCaptcha: Site key mancante. Inserisci la chiave in <meta name="captcha-site-key">.');
            showNote(el, 'Verifica di sicurezza non configurata.');
            return Promise.resolve(null);
        }

        return loadApi().then(function (api) {
            var previous = widgets[containerId];
            if (previous) { try { api.remove(previous.id); } catch (e) { /* già rimosso */ } }
            el.textContent = '';

            var entry = { id: null, token: '' };
            entry.id = api.render(el, {
                sitekey: SITE_KEY,
                language: 'it',
                theme: options.theme || 'light',
                size: el.clientWidth && el.clientWidth < 300 ? 'compact' : 'normal',
                callback: function (token) { entry.token = token; },
                'expired-callback': function () { entry.token = ''; },
                'error-callback': function () { entry.token = ''; }
            });
            widgets[containerId] = entry;
            return entry.id;
        }).catch(function (err) {
            showNote(el, err.message || 'Verifica di sicurezza non disponibile.');
            return null;
        });
    }

    function getToken(containerId) {
        var entry = widgets[containerId];
        return entry ? entry.token : '';
    }

    function reset(containerId) {
        var entry = widgets[containerId];
        if (!entry) return;
        entry.token = '';
        try { window.turnstile.reset(entry.id); } catch (e) { /* ignora */ }
    }

    window.PCDCaptcha = { isConfigured: function () { return configured; }, render: render, getToken: getToken, reset: reset };

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-captcha][id]').forEach(function (el) { render(el.id); });
    });
})();
