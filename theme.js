/*
 * Pronto Click Dottore - Tema chiaro / scuro
 *
 * - Di default segue le impostazioni del dispositivo di chi visita il sito
 *   (prefers-color-scheme) e si aggiorna da solo se l'utente le cambia.
 * - Qualsiasi elemento con attributo data-theme-toggle diventa il pulsante per
 *   cambiare tema a mano. La scelta viene ricordata; se l'utente torna al tema
 *   del dispositivo, la scelta manuale viene dimenticata e si riparte in automatico.
 *
 * Va caricato nell'<head>, senza defer, per evitare il lampo di sfondo chiaro.
 */
(function () {
    'use strict';

    var KEY = 'pcd-theme';
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function stored() {
        try {
            var v = localStorage.getItem(KEY);
            return v === 'dark' || v === 'light' ? v : null;
        } catch (e) { return null; }
    }
    function save(v) {
        try {
            if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY);
        } catch (e) { /* storage non disponibile */ }
    }
    function system() { return mq && mq.matches ? 'dark' : 'light'; }
    function current() { return stored() || system(); }

    function paintButtons(theme) {
        var dark = theme === 'dark';
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            var label = dark ? 'Passa al tema chiaro' : 'Passa al tema scuro';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.setAttribute('aria-pressed', String(dark));
            var icon = btn.querySelector('i');
            if (icon) icon.className = dark ? 'fa-solid fa-sun text-lg' : 'fa-solid fa-moon text-lg';
        });
    }

    function apply() {
        var theme = current();
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = theme === 'dark' ? '#0b1220' : '#ffffff';
        paintButtons(theme);
    }

    function toggle() {
        var next = current() === 'dark' ? 'light' : 'dark';
        // se la scelta coincide con il tema del dispositivo, torna in automatico
        save(next === system() ? null : next);
        // disattiva le transizioni, applica il tema, forza il ricalcolo e le riattiva al frame successivo
        root.classList.add('theme-switching');
        apply();
        void root.offsetHeight;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { root.classList.remove('theme-switching'); });
        });
    }

    apply();

    if (mq) {
        var onChange = function () { if (!stored()) apply(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }
    window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.closest && t.closest('[data-theme-toggle]')) toggle();
    });
    document.addEventListener('DOMContentLoaded', function () { paintButtons(current()); });

    window.PCDTheme = { get: current, toggle: toggle };
})();
