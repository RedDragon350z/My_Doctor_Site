/*
 * Pronto Click Dottore - "Click", l'assistente del sito
 *
 * Uso: in fondo a ogni pagina, prima di </body>:
 *     <script src="click-chat.js" defer></script>
 *
 * Come funziona (due cervelli, un solo assistente):
 *   1) IA online  -> chiama la funzione Supabase "click-chat" (modello Claude, chiave solo sul server).
 *   2) Guida base -> se la funzione non c'è o non risponde, Click risponde da solo, nel browser,
 *                    con la mappa del sito (funziona anche senza server e senza chiavi).
 *
 * Click può anche AGIRE sul sito: evidenziare un pulsante ("mostrami dove"), aprire una pagina,
 * avviare una ricerca (specializzazione + città), aprire il login.
 *
 * Legge dalle meta della pagina "supabase-url" e "supabase-key". Supporta il tema scuro
 * (classe "dark" su <html>) e prefers-reduced-motion.
 */
(function (root) {
    'use strict';

    /* =====================================================================
     *  DATI DEL SITO
     * ===================================================================== */
    var PAGES = {
        home:         { file: 'index.html',                      it: 'la Home',                       en: 'the Home page' },
        patient:      { file: 'registrazione-paziente.html',     it: 'la registrazione Paziente',     en: 'patient sign-up' },
        professional: { file: 'registrazione-professionista.html', it: 'la registrazione Professionista', en: 'professional sign-up' },
        center:       { file: 'registrazione-centro-medico.html', it: 'la registrazione Centro Medico', en: 'medical centre sign-up' }
    };

    // Elementi della pagina che Click sa evidenziare
    var TARGETS = {
        login:        { sel: ['#login-link'],                                   mobile: '#mobile-menu [data-auth-label]', it: 'il pulsante Login',                 en: 'the Login button' },
        register:     { sel: ['#register-dropdown-container > button'],        mobile: '#mobile-menu a[href="registrazione-paziente.html"]', menu: 'register-dropdown', it: 'il menu "Registrati gratis"', en: 'the "Registrati gratis" menu' },
        professional: { sel: ['#pro-dropdown-container > button'],             mobile: '#mobile-menu a[href="registrazione-professionista.html"]', menu: 'pro-dropdown', it: 'il menu "Sei un Professionista sanitario?"', en: 'the "Sei un Professionista sanitario?" menu' },
        specialty:    { sel: ['#specialty-input'],                              it: 'la casella "Specializzazione o Medico"', en: 'the "Specializzazione o Medico" box' },
        city:         { sel: ['#location-input'],                               it: 'la casella "Città o CAP"',            en: 'the "Città o CAP" box' },
        theme:        { sel: ['[data-theme-toggle]'],                           it: 'il pulsante luna/sole (tema chiaro/scuro)', en: 'the moon/sun button (light/dark theme)' },
        appointments: { sel: ['#my-appointments-link'],                         mobile: '#mobile-menu [data-auth-only]', it: 'la voce "Le mie visite"',            en: 'the "Le mie visite" link' },
        specialties:  { sel: ['#specialties-quick-container'],                  it: 'l\'elenco delle specializzazioni',    en: 'the list of specialties' },
        cities:       { sel: ['#cities-quick-container'],                       it: 'l\'elenco dei capoluoghi',            en: 'the list of provincial capitals' },
        footer:       { sel: ['footer'],                                        it: 'il piè di pagina (footer)',           en: 'the page footer' }
    };

    // Specializzazioni: [nome ESATTO usato dal sito, parole "dirette", parole "sintomo/parte del corpo"]
    // Una parola che finisce con $ deve coincidere per intero; le altre valgono come inizio di parola.
    var SPECS = [
        ['Dermatologia e Venereologia', ['dermatolog', 'venereolog'], ['pelle$', 'acne$', 'eczema', 'psoriasi', 'dermatite', 'macchie della pelle', 'verruche', 'orticaria']],
        ['Cardiologia', ['cardiolog'], ['cuore$', 'palpitazion', 'pressione alta', 'ipertension', 'aritmi']],
        ['Ginecologia e Ostetricia', ['ginecolog', 'ostetric', 'pap test'], ['gravidanza', 'incinta$', 'ciclo mestruale', 'mestruazion', 'menopausa']],
        ['Odontoiatria e Dentisteria', ['dentist', 'odontoiatr', 'otturazione', 'pulizia dei denti', 'igienista dentale', 'dentist$'], ['dente$', 'denti$', 'carie$', 'mal di denti', 'gengive']],
        ['Oculistica (Oftalmologia)', ['oculist', 'oftalmolog', 'visita oculistica', 'occhiali'], ['occhi$', 'occhio$', 'vista$', 'cataratta']],
        ['Ortopedia e Traumatologia', ['ortoped', 'traumatolog'], ['schiena$', 'mal di schiena', 'ginocchio', 'spalla$', 'anca$', 'frattura', 'caviglia', 'cervicale$', 'ossa$', 'distorsione']],
        ['Pediatria', ['pediatr'], ['neonato', 'neonati$', 'bambino$', 'bambini$', 'mio figlio', 'mia figlia']],
        ['Psicologia', ['psicolog'], ['ansia$', 'stress$', 'attacchi di panico', 'attacco di panico', 'tristezza', 'burnout']],
        ['Psichiatria', ['psichiatr'], ['depressione', 'disturbo bipolare']],
        ['Psicoterapia', ['psicoterap'], []],
        ['Nutrizione Clinica', ['nutrizionist', 'dietolog', 'dietist', 'dieta$', 'dimagrire', 'perdere peso'], ['obesita']],
        ['Fisioterapia', ['fisioterap', 'riabilitazione', 'riabilitare'], []],
        ['Otorinolaringoiatria', ['otorino', 'otorinolaringoiatr'], ['orecchio$', 'orecchie$', 'gola$', 'naso$', 'sinusite', 'mal di gola', 'tonsille', 'raucedine']],
        ['Urologia', ['urolog'], ['prostata', 'calcoli renali', 'cistite']],
        ['Neurologia', ['neurolog'], ['emicrania', 'mal di testa', 'vertigini', 'tremore']],
        ['Endocrinologia', ['endocrinolog'], ['tiroide']],
        ['Gastroenterologia', ['gastroenterolog'], ['stomaco$', 'mal di stomaco', 'reflusso', 'colon$', 'intestino', 'gastrite']],
        ['Reumatologia', ['reumatolog'], ['artrite', 'artrosi', 'dolori articolari']],
        ['Allergologia e Immunologia', ['allergolog', 'immunolog'], ['allergia', 'allergie$', 'allergico']],
        ['Oncologia', ['oncolog'], ['tumore', 'tumori$']],
        ['Pneumologia', ['pneumolog'], ['polmoni', 'polmone$', 'asma$', 'bronchite']],
        ['Diabetologia', ['diabetolog'], ['diabete$', 'glicemia']],
        ['Medicina Generale (Medico di Base / Famiglia)', ['medico di base', 'medico di famiglia', 'medico curante', 'mmg$', 'medicina generale', 'medico generico', 'general practitioner', 'family doctor', 'gp$'], []],
        ['Osteopatia', ['osteopat'], []],
        ['Logopedia', ['logoped'], []],
        ['Podologia', ['podolog'], ['piedi$', 'unghia incarnita']],
        ['Sessuologia', ['sessuolog'], []],
        ['Radiologia e Radiodiagnostica', ['radiolog', 'risonanza', 'radiografia', 'ecografia', 'tac$', 'mammografia', 'moc$'], []],
        ['Medicina Estetica', ['medicina estetica', 'botox', 'filler$'], ['rughe$']],
        ['Medicina dello Sport', ['medicina dello sport', 'medico sportivo', 'certificato sportivo', 'idoneita sportiva', 'certificato agonistico'], []],
        ['Geriatria', ['geriatr'], []],
        ['Chirurgia Plastica, Estetica e Ricostruttiva', ['chirurgia plastica', 'chirurgo plastico', 'rinoplastica', 'mastoplastica'], []],
        ['Nefrologia', ['nefrolog'], ['reni$', 'rene$']],
        ['Ematologia', ['ematolog'], ['anemia']],
        ['Angiologia', ['angiolog'], ['vene varicose', 'varici$', 'circolazione']],
        ['Proctologia', ['proctolog'], ['emorroidi']],
        ['Senologia', ['senolog'], ['seno$', 'mammella']],
        ['Tricologia', ['tricolog'], ['capelli$', 'caduta dei capelli', 'calvizie']],
        ['Andrologia', ['androlog'], []],
        ['Neuropsichiatria Infantile', ['neuropsichiatra infantile', 'neuropsichiatria'], []],
        ['Medicina del Lavoro', ['medicina del lavoro', 'medico del lavoro'], []],
        ['Ortodonzia', ['ortodon', 'apparecchio dentale'], ['apparecchio ai denti']],
        ['Chirurgia Generale', ['chirurg$', 'chirurgia generale'], []],
        ['Infettivologia', ['infettivolog'], []],
        ['Epatologia', ['epatolog'], ['fegato$']],
        ['Anestesia e Rianimazione', ['anestesist'], []],
        ['Naturopatia', ['naturopat'], []],
        ['Omeopatia', ['omeopat'], []],
        ['Neuropsicologia', ['neuropsicolog'], []],
        ['Audiologia e Foniatria', ['audiolog', 'foniatr'], ['udito$', 'sordita']],
        ['Fisiatria (Medicina Fisica e Riabilitativa)', ['fisiatr'], []],
        ['Medicina Interna', ['medicina interna', 'internista'], []],
        ['Genetica Medica', ['geneticist', 'genetica medica'], []]
    ];

    /* =====================================================================
     *  UTILITÀ DI TESTO
     * ===================================================================== */
    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    var termCache = {};
    function termRegex(term) {
        if (termCache[term]) return termCache[term];
        var exact = /\$$/.test(term);
        var t = term.replace(/\$$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        termCache[term] = new RegExp('(^| )' + t + (exact ? '( |$)' : ''));
        return termCache[term];
    }
    function hasTerm(n, term) { return termRegex(term).test(n); }
    function countTerms(n, terms) {
        var c = 0;
        for (var i = 0; i < terms.length; i++) if (hasTerm(n, terms[i])) c++;
        return c;
    }

    var EN_WORDS = ['the', 'how', 'where', 'what', 'can', 'do', 'doctor', 'appointment', 'register', 'sign', 'price', 'cost', 'find', 'book', 'help', 'please', 'my', 'is', 'are', 'you', 'i', 'want', 'need', 'looking', 'hello', 'hi', 'thanks', 'thank'];
    var IT_WORDS = ['il', 'la', 'le', 'lo', 'come', 'dove', 'che', 'cosa', 'posso', 'medico', 'dottore', 'prenotare', 'registrare', 'prezzo', 'costo', 'trovare', 'aiuto', 'per', 'favore', 'mio', 'mia', 'sono', 'vorrei', 'cerco', 'ciao', 'grazie', 'un', 'una', 'di', 'in', 'ho', 'devo'];
    function detectLang(n) {
        var w = n.split(' '), en = 0, it = 0;
        for (var i = 0; i < w.length; i++) {
            if (EN_WORDS.indexOf(w[i]) > -1) en++;
            if (IT_WORDS.indexOf(w[i]) > -1) it++;
        }
        return en > it ? 'en' : 'it';
    }

    function shortSpec(name) { return name.split(' (')[0].split(' e ')[0].split(',')[0]; }

    /* =====================================================================
     *  EMERGENZE (hanno sempre la precedenza)
     * ===================================================================== */
    var EMERGENCY = ['dolore al petto', 'dolore forte al petto', 'infarto', 'ictus', 'non riesco a respirare', 'non respiro', 'fatica a respirare',
        'emorragia', 'sangue che non si ferma', 'overdose', 'avvelenament', 'convulsion', 'svenut', 'perso i sensi', 'non risponde',
        'soffocando', 'soffoca$', 'chest pain', 'heart attack', "can t breathe", 'cannot breathe', 'unconscious'];
    var CRISIS = ['suicid', 'uccidermi', 'togliermi la vita', 'farla finita', 'non voglio piu vivere', 'voglio morire', 'ammazzarmi', 'kill myself', 'end my life', 'want to die'];

    function emergencyReply(n, lang) {
        if (countTerms(n, CRISIS)) {
            return lang === 'en'
                ? { text: "I'm really sorry you're going through this. You don't have to face it alone.\n- If you are in immediate danger, call **112** now.\n- In Italy you can also call **Telefono Amico: 02 2327 2327**, or go to the nearest emergency room.\nIf you can, tell someone close to you how you feel right now.", actions: [] }
                : { text: "Mi dispiace molto che tu stia passando questo momento. Non devi affrontarlo da solo.\n- Se sei in pericolo immediato chiama subito il **112**.\n- Puoi anche chiamare **Telefono Amico: 02 2327 2327** oppure recarti al pronto soccorso più vicino.\nSe puoi, parla adesso con una persona di fiducia vicino a te.", actions: [] };
        }
        if (countTerms(n, EMERGENCY)) {
            return lang === 'en'
                ? { text: "This could be an emergency. **Call 112 (or 118) right now** or go to the nearest emergency room. Don't wait for an online appointment.", actions: [] }
                : { text: "Potrebbe essere un'emergenza. **Chiama subito il 112 (o il 118)** o vai al pronto soccorso più vicino. Non aspettare una prenotazione online.", actions: [] };
        }
        return null;
    }

    /* =====================================================================
     *  AZIONI
     * ===================================================================== */
    var A = {
        go: function (page) { return { type: 'go', page: page }; },
        show: function (target) { return { type: 'show', target: target }; },
        search: function (specialty, city) { return { type: 'search', specialty: specialty, city: city || '' }; },
        login: function () { return { type: 'login' }; }
    };

    function actionLabel(a, lang) {
        var en = lang === 'en';
        if (a.type === 'go') return (en ? 'Open ' : 'Apri ') + (PAGES[a.page] ? PAGES[a.page][lang === 'en' ? 'en' : 'it'] : a.page);
        if (a.type === 'show') return en ? 'Show me where' : 'Mostrami dove';
        if (a.type === 'login') return en ? 'Open login' : 'Apri il login';
        if (a.type === 'search') {
            var s = shortSpec(a.specialty);
            return (en ? 'Search ' : 'Cerca ') + s + (a.city ? (en ? ' in ' : ' a ') + a.city : '');
        }
        return 'OK';
    }

    /* =====================================================================
     *  CITTÀ (usa l'indice dei comuni della Home, se presente)
     * ===================================================================== */
    var EN_CITY = { rome: 'roma', milan: 'milano', naples: 'napoli', turin: 'torino', florence: 'firenze', venice: 'venezia', genoa: 'genova', padua: 'padova', syracuse: 'siracusa', mantua: 'mantova' };
    var CITY_PREPS = ['a', 'ad', 'in', 'di', 'su', 'da', 'per', 'presso', 'vicino', 'zona', 'nel', 'nella', 'citta', 'comune', 'e', 'in', 'near', 'around', 'at'];

    function detectCity(n) {
        var cap = n.match(/(?:^| )(\d{5})(?: |$)/);
        if (cap) return cap[1];
        var sp = root.searchPlaces;
        if (typeof sp !== 'function') return '';
        var w = n.split(' ');
        function lookup(cand) {
            cand = EN_CITY[cand] || cand;
            try {
                var r = sp(cand, 5) || [];
                for (var i = 0; i < r.length; i++) {
                    var p = r[i].place || {};
                    if (norm(p.shortName || p.name) === cand) return p.shortName || p.name;
                }
            } catch (e) { /* ignora */ }
            return '';
        }
        // il messaggio è solo una città (es. risposta a "in quale città?")
        if (w.length <= 3 && w.join(' ').length >= 3) {
            var whole = lookup(w.join(' '));
            if (whole) return whole;
        }
        for (var len = 3; len >= 1; len--) {
            for (var i = w.length - len; i >= 1; i--) {
                if (CITY_PREPS.indexOf(w[i - 1]) === -1) continue;
                var cand = w.slice(i, i + len).join(' ');
                if (cand.length < 3) continue;
                var hit = lookup(cand);
                if (hit) return hit;
            }
        }
        return '';
    }

    /* =====================================================================
     *  SPECIALIZZAZIONE DALLA FRASE
     * ===================================================================== */
    function detectSpecialty(n) {
        var best = null;
        for (var i = 0; i < SPECS.length; i++) {
            var d = countTerms(n, SPECS[i][1]);
            var s = countTerms(n, SPECS[i][2]);
            if (!d && !s) continue;
            var score = d ? 3 + d : 1 + s * 0.5;
            if (!best || score > best.score) best = { name: SPECS[i][0], direct: d > 0, score: score };
        }
        return best;
    }

    /* =====================================================================
     *  CERVELLO LOCALE (guida base del sito)
     * ===================================================================== */
    var CHIPS_IT = ['Come prenoto una visita?', 'Dove trovo il login?', 'Cerco un dermatologo a Milano', 'Sono un medico: come mi iscrivo?'];
    var CHIPS_EN = ['How do I book a visit?', 'Where is the login?', 'I need a dentist in Rome', "I'm a doctor: how do I join?"];

    var INTENTS = [
        {
            id: 'who', prio: 5, terms: ['chi sei', 'come ti chiami', 'cosa sai fare', 'cosa puoi fare', 'cosa fai$', 'chi e click', 'who are you', 'what can you do', 'what do you do', 'sei un bot', 'sei una ia', 'sei umano', 'tuo nome'],
            reply: function (c) {
                return { text: c.L('Sono **Click**, l\'assistente di Pronto Click Dottore. Ti aiuto a:\n- trovare un medico o uno specialista\n- prenotare e ritrovare le tue visite\n- registrarti come paziente, professionista o centro medico\n- capire dove si trova ogni cosa sul sito (posso anche indicartela con un\'evidenziazione!)\nNon faccio diagnosi e non sostituisco il medico.',
                    'I\'m **Click**, the Pronto Click Dottore assistant. I can help you:\n- find a doctor or specialist\n- book and review your visits\n- sign up as a patient, professional or medical centre\n- find where everything is on the site (I can even highlight it for you!)\nI don\'t give diagnoses and I don\'t replace your doctor.'), chips: true };
            }
        },
        {
            id: 'greet', prio: 1, terms: ['ciao$', 'salve$', 'buongiorno', 'buonasera', 'buon pomeriggio', 'ehi$', 'hey$', 'hello$', 'hi$', 'good morning', 'good evening'], short: 4,
            reply: function (c) { return { text: c.L('Ciao! Sono **Click**. Dimmi pure cosa cerchi: un medico, una prenotazione, come registrarti… oppure dove si trova qualcosa sul sito.', 'Hi! I\'m **Click**. Tell me what you\'re looking for: a doctor, a booking, how to sign up… or where something is on the site.'), chips: true }; }
        },
        {
            id: 'thanks', prio: 1, terms: ['grazie', 'ti ringrazio', 'thanks', 'thank you', 'gentilissimo', 'perfetto$', 'ottimo$', 'ok grazie'], short: 5,
            reply: function (c) { return { text: c.L('Di nulla! Se ti serve altro, sono qui. 😊', 'You\'re welcome! I\'m here if you need anything else. 😊') }; }
        },
        {
            id: 'bye', prio: 1, terms: ['arrivederci', 'a presto', 'alla prossima', 'bye$', 'goodbye', 'buona giornata', 'buona serata'], short: 5,
            reply: function (c) { return { text: c.L('A presto! Quando vuoi, clicca su Click e sono di nuovo qui.', 'See you soon! Click on Click whenever you need me.') }; }
        },
        {
            id: 'howareyou', prio: 1, terms: ['come stai', 'come va$', 'how are you'], short: 5,
            reply: function (c) { return { text: c.L('Tutto bene, grazie! Pronto a darti una mano con il sito. Cosa ti serve?', 'All good, thanks! Ready to help you with the site. What do you need?'), chips: true }; }
        },
        {
            id: 'about', prio: 3, terms: ['cos e pronto click', 'che cos e', 'a cosa serve', 'come funziona il sito', 'come funziona pronto', 'cosa offre', 'what is this', 'what is pronto', 'how does it work', 'come funziona$', 'di cosa si tratta'],
            reply: function (c) {
                return { text: c.L('**Pronto Click Dottore** ti permette di:\n- cercare medici, specialisti e centri per specializzazione e città (o CAP)\n- prenotare una visita online: per i pazienti la prenotazione è gratuita\n- ritrovare le tue visite nella sezione "Le mie visite"\nI professionisti e i centri medici possono iscriversi per ricevere prenotazioni.',
                    '**Pronto Click Dottore** lets you:\n- search doctors, specialists and centres by specialty and city (or postcode)\n- book a visit online: booking is free for patients\n- find your visits again in "Le mie visite"\nProfessionals and medical centres can sign up to receive bookings.'),
                    actions: [A.show('specialty')] };
            }
        },
        {
            id: 'find', prio: 3, terms: ['come cerco', 'come trovo', 'come si cerca', 'trovare un', 'trovare il', 'cercare un', 'cercare il', 'dove cerco', 'barra di ricerca', 'ricerca$', 'cerca$', 'cercare$', 'search$', 'find a', 'find doctor', 'looking for', 'trovare$', 'cerco un', 'cerco il', 'cerco una', 'vorrei un', 'ho bisogno di un', 'ho bisogno di una', 'mi serve un', 'mi serve una', 'need a'],
            reply: function (c) {
                return { text: c.L('Per cercare un professionista:\n- scrivi la **specializzazione** (o il nome del medico) nella prima casella\n- scrivi la **città o il CAP** nella seconda\n- premi **Cerca**\nTi basta iniziare a scrivere: i suggerimenti compaiono da soli. Dimmi anche solo cosa ti serve (per esempio "cerco un dermatologo a Torino") e ti preparo la ricerca.',
                    'To find a professional:\n- type the **specialty** (or the doctor\'s name) in the first box\n- type the **city or postcode** in the second\n- press **Cerca**\nSuggestions appear as you type. Or just tell me what you need (e.g. "I need a dentist in Rome") and I\'ll set up the search.'),
                    actions: [A.show('specialty')] };
            }
        },
        {
            id: 'book', prio: 3, terms: ['prenot', 'appuntament', 'fissare', 'book$', 'booking', 'appointment', 'schedule', 'orari disponibili', 'disponibilita', 'visita online', 'prendere una visita'],
            reply: function (c) {
                return { text: c.L('Per prenotare una visita:\n- cerca il professionista (specializzazione + città o CAP)\n- sul risultato che ti interessa premi **Prenota visita**\n- se non hai ancora effettuato l\'accesso ti chiederà di entrare o di registrarti come **Paziente** (ci vuole un minuto)\n- scegli giorno e orario, aggiungi se vuoi il motivo della visita e conferma\nPuoi ritrovare tutto in **Le mie visite** (compare nel menu dopo il login). Per i pazienti la prenotazione è gratuita.',
                    'To book a visit:\n- search for the professional (specialty + city or postcode)\n- on the result you like press **Prenota visita**\n- if you\'re not signed in you\'ll be asked to log in or register as a **Patient** (it takes a minute)\n- pick a day and time, optionally add the reason, and confirm\nYou\'ll find everything again in **Le mie visite** (shown in the menu after login). Booking is free for patients.'),
                    actions: [A.show('specialty'), A.go('patient')] };
            }
        },
        {
            id: 'myvisits', prio: 4, terms: ['mie visite', 'miei appuntamenti', 'mie prenotazioni', 'le mie visite', 'my appointments', 'my visits', 'my bookings', 'disdire', 'disdetta', 'annullare la visita', 'annullare una visita', 'cancellare la visita', 'spostare la visita', 'cancel my', 'reschedule', 'disdic', 'disdir', 'disdett', 'annullare la', 'annullo la', 'spostare la', 'sposto la'],
            reply: function (c) {
                return { text: c.L('Le tue prenotazioni sono in **Le mie visite**: la voce compare nel menu in alto **dopo aver effettuato l\'accesso** (su telefono, dentro il menu a tre righe).\nSe devi disdire o spostare una visita, non ho informazioni certe su come farlo dal sito: apri Le mie visite per vedere cosa è disponibile oppure contatta direttamente lo studio.',
                    'Your bookings are in **Le mie visite**: the link appears in the top menu **after you log in** (on phones, inside the three-line menu).\nIf you need to cancel or reschedule, I don\'t have reliable info on how to do it from the site: open Le mie visite to see what\'s available or contact the practice directly.'),
                    actions: [A.show('appointments'), A.login()] };
            }
        },
        {
            id: 'login', prio: 4, terms: ['login', 'log in', 'sign in', 'accedere', 'accedo', 'accedi', 'entrare', 'entro nel', 'logout', 'log out', 'uscire', 'esci$', 'disconnett', 'ho gia un account', 'sono gia registrato', 'sono gia iscritto'],
            reply: function (c) {
                return { text: c.L('Il **Login** è in alto a destra nel menu (su telefono: dentro il menu a tre righe). Inserisci email e password, completa la verifica di sicurezza e premi accedi. Dopo il login la stessa voce diventa **Esci**.\nNon hai un account? Registrati come Paziente: è gratuito.',
                    'The **Login** is at the top right of the menu (on phones: inside the three-line menu). Enter your email and password, complete the security check and sign in. After login the same link becomes **Esci** (log out).\nNo account yet? Sign up as a Patient: it\'s free.'),
                    actions: [A.show('login'), A.login(), A.go('patient')] };
            }
        },
        {
            id: 'password', prio: 5, terms: ['password dimenticata', 'dimenticato la password', 'ho dimenticato', 'recuperare la password', 'recupero password', 'reset password', 'cambiare password', 'forgot password', 'non riesco ad accedere', 'non riesco a entrare'],
            reply: function (c) {
                return { text: c.L('Nel sito non vedo, al momento, una funzione di recupero password nel modulo di login. Controlla di aver scritto bene email e password e di aver **confermato l\'email** ricevuta dopo la registrazione (senza conferma l\'accesso può non funzionare). Se il problema resta, scrivi al team del sito dai contatti ufficiali.',
                    'I can\'t see a password-recovery feature in the login form at the moment. Check that your email and password are right and that you **confirmed the email** you received after signing up (without it, login may fail). If the problem persists, contact the site team through the official contacts.'),
                    actions: [A.login()] };
            }
        },
        {
            id: 'register', prio: 4, terms: ['registr', 'iscriv', 'iscrizion', 'creare un account', 'creare account', 'nuovo account', 'aprire un account', 'sign up', 'signup', 'register', 'join$', 'become a member'],
            reply: function (c) {
                var n = c.n;
                var pro = /(^| )(medico|dottore|dottoressa|professionista|mmg|farmacia|farmacista|doctor|physician|pharmacy|professional|studio|specialista|psicologo|dentista|fisioterapista|nutrizionista)/.test(n);
                var ctr = /(^| )(centro|clinica|poliambulatorio|struttura|ambulatorio|laboratorio|centre|center|clinic)/.test(n);
                var pat = /(^| )(paziente|patient|utente)/.test(n);
                if (ctr && !pat) {
                    return { text: c.L('Per iscrivere un **Centro Medico**: menu **Registrati gratis → Come Centro Medico**. Servono ragione sociale e partita IVA, estremi dell\'autorizzazione sanitaria (numero ed ente), nome e numero d\'albo del direttore sanitario e una PEC o email aziendale. Il team verifica autorizzazione e iscrizione all\'albo, poi attiva l\'account.',
                        'To sign up a **Medical Centre**: menu **Registrati gratis → Come Centro Medico**. You\'ll need company name and VAT number, health authorisation details (number and issuing body), the medical director\'s name and register number, and a PEC or business email. The team checks the authorisation and register membership, then activates the account.'),
                        actions: [A.go('center'), A.show('register')] };
                }
                if (pro && !pat) {
                    return { text: c.L('Per iscriverti come **Professionista** (medico, specialista, MMG, farmacia o struttura partner): menu **Registrati gratis → Come Dottore / MMG** oppure **Sei un Professionista sanitario?**. Compili il modulo con i dati professionali e il numero d\'iscrizione all\'albo; il team verifica l\'iscrizione e poi attiva l\'account con agenda e prenotazioni.',
                        'To sign up as a **Professional** (doctor, specialist, GP, pharmacy or partner facility): menu **Registrati gratis → Come Dottore / MMG** or **Sei un Professionista sanitario?**. Fill in the form with your professional details and register number; the team verifies your membership and then activates the account with agenda and bookings.'),
                        actions: [A.go('professional'), A.show('professional')] };
                }
                if (pat) {
                    return { text: c.L('Per registrarti come **Paziente**: menu **Registrati gratis → Come Paziente**. Servono nome, cognome, codice fiscale, telefono, email e una password di almeno 8 caratteri; accetti il trattamento dei dati e completi la verifica di sicurezza. Poi controlla l\'email per **confermare l\'account**.',
                        'To sign up as a **Patient**: menu **Registrati gratis → Come Paziente**. You need first and last name, fiscal code, phone, email and a password of at least 8 characters; you accept data processing and complete the security check. Then check your email to **confirm the account**.'),
                        actions: [A.go('patient'), A.show('register')] };
                }
                return { text: c.L('Puoi registrarti gratis in tre modi (menu **Registrati gratis**):\n- **Come Paziente**: per prenotare visite\n- **Come Dottore / MMG**: per ricevere prenotazioni\n- **Come Centro Medico**: per cliniche e poliambulatori\nChe tipo di account ti serve?',
                    'You can sign up for free in three ways (menu **Registrati gratis**):\n- **Come Paziente**: to book visits\n- **Come Dottore / MMG**: to receive bookings\n- **Come Centro Medico**: for clinics and polyclinics\nWhich account type do you need?'),
                    actions: [A.go('patient'), A.go('professional'), A.go('center')] };
            }
        },
        {
            id: 'plans', prio: 4, terms: ['prezz', 'costo', 'costi$', 'costa', 'quanto costa', 'tariff', 'abbonament', 'piano base', 'piani$', 'commission', 'canone', 'mensile', 'gratis', 'gratuit', 'pagare', 'pagamento', 'price', 'pricing', 'cost$', 'how much', 'subscription', 'free$', 'fee$'],
            reply: function (c) {
                return { text: c.L('**Per i pazienti**: cercare e prenotare una visita è gratuito. Il prezzo della prestazione è indicato dal professionista sulla sua scheda (campo \"Da\").\n**Per i professionisti e i centri medici**: le condizioni economiche vengono comunicate dal team solo dopo l\'iscrizione e la verifica dei dati.',
                    '**For patients**: searching and booking a visit is free. The price of the service is shown by the professional on their card (\"Da\" field).\n**For professionals and medical centres**: the team communicates the financial terms only after sign-up and verification of your details.'),
                    actions: [A.go('professional')] };
            }
        },
        {
            id: 'albo', prio: 5, terms: ['albo', 'verifica dell iscrizione', 'verificano', 'verifica iscrizione', 'documenti servono', 'cosa serve per iscriversi', 'cosa serve per registrar', 'what do i need to register', 'required documents'],
            reply: function (c) {
                return { text: c.L('Per i **professionisti** serve il numero d\'iscrizione all\'albo/ordine e una PEC o email professionale. Per i **centri medici** servono P.IVA, autorizzazione sanitaria e i dati del direttore sanitario. In entrambi i casi il team **verifica** i dati prima di attivare l\'account.',
                    'For **professionals** you need your register/order number and a PEC or professional email. For **medical centres** you need VAT number, health authorisation and the medical director\'s details. In both cases the team **verifies** the data before activating the account.'),
                    actions: [A.go('professional'), A.go('center')] };
            }
        },
        {
            id: 'theme', prio: 5, terms: ['tema', 'dark mode', 'light mode', 'modalita scura', 'modalita notte', 'modalita chiara', 'sfondo scuro', 'sfondo chiaro', 'scuro$', 'tema scuro', 'cambiare colore', 'dark theme'],
            reply: function (c) {
                return { text: c.L('Il pulsante **luna/sole** in alto (accanto al menu) cambia tra tema chiaro e scuro. Di default il sito segue le impostazioni del tuo dispositivo e ricorda la tua scelta.',
                    'The **moon/sun** button at the top (next to the menu) switches between light and dark theme. By default the site follows your device settings and remembers your choice.'),
                    actions: [A.show('theme')] };
            }
        },
        {
            id: 'privacy', prio: 5, terms: ['privacy', 'gdpr', 'dati personali', 'trattamento dei dati', 'cookie', 'termini e condizioni', 'termini$', 'condizioni$', 'informativa', 'terms$', 'data protection'],
            reply: function (c) {
                return { text: c.L('Nel **piè di pagina** trovi Privacy Policy (GDPR), Termini e Condizioni e Informativa Cookie; nel menu in alto c\'è anche **Trattamento dei dati**. Nei moduli di registrazione ti chiediamo il consenso al trattamento dei dati ai sensi del GDPR (UE 2016/679).',
                    'In the **footer** you\'ll find the Privacy Policy (GDPR), Terms and Conditions and Cookie Notice; the top menu also has **Trattamento dei dati**. The sign-up forms ask for your consent to data processing under the GDPR (EU 2016/679).'),
                    actions: [A.show('footer')] };
            }
        },
        {
            id: 'video', prio: 5, terms: ['videoconsult', 'video consulto', 'videovisita', 'video visita', 'telemedicina', 'teleconsult', 'visita a distanza', 'visita online da casa', 'video call', 'video consultation', 'telehealth'],
            reply: function (c) {
                return { text: c.L('Nel piè di pagina c\'è la voce **Videoconsulto**, ma non ho informazioni sicure sul suo stato o su quali professionisti lo offrano. Ti consiglio di guardare la scheda del medico che ti interessa o di chiedere direttamente allo studio.',
                    'The footer has a **Videoconsulto** link, but I have no reliable info on its status or which professionals offer it. Check the doctor\'s card or ask the practice directly.'),
                    actions: [A.show('footer')] };
            }
        },
        {
            id: 'rx', prio: 5, terms: ['prescrizion', 'ricetta', 'ricette$', 'impegnativa', 'prescription', 'referti', 'referto', 'analisi'],
            reply: function (c) {
                return { text: c.L('La Home presenta tra i servizi la richiesta di **prescrizioni** e la condivisione di esiti e analisi con il medico di base, ma non ho un percorso guidato da indicarti. Un buon punto di partenza è cercare il tuo **medico di base** e usare la sua scheda.',
                    'The Home page lists requesting **prescriptions** and sharing results with your GP among the services, but I don\'t have a guided path to point you to. A good start is to search for your **GP** and use their card.'),
                    actions: [A.search('Medicina Generale (Medico di Base / Famiglia)', '')] };
            }
        },
        {
            id: 'reminders', prio: 5, terms: ['promemoria', 'sms$', 'reminder', 'notifich', 'ricordare la visita', 'email di conferma'],
            reply: function (c) {
                return { text: c.L('Dopo una prenotazione il sito ti ricorda la visita con **email e SMS**, come indicato nella Home. Controlla che l\'email e il telefono inseriti in registrazione siano corretti.',
                    'After you book, the site reminds you of the visit by **email and SMS**, as stated on the Home page. Make sure the email and phone number you gave at sign-up are correct.')};
            }
        },
        {
            id: 'support', prio: 5, terms: ['contatt', 'assistenza', 'supporto', 'segnalare', 'segnalazione', 'bug$', 'non funziona', 'errore$', 'problema tecnico', 'reclamo', 'support$', 'contact$', 'help desk', 'not working'],
            reply: function (c) {
                return { text: c.L('Non ho un recapito di assistenza ufficiale da darti con certezza. Se qualcosa non funziona, dimmi **cosa stavi facendo** e **che messaggio vedi**: provo a darti una mano. Per questioni sul tuo account o sulle prenotazioni puoi anche contattare direttamente lo studio medico.',
                    'I don\'t have an official support contact I can give you with certainty. If something isn\'t working, tell me **what you were doing** and **what message you see**, and I\'ll try to help. For account or booking matters you can also contact the practice directly.') };
            }
        },
        {
            id: 'where_specialties', prio: 4, terms: ['elenco delle specializzazioni', 'lista specializzazioni', 'tutte le specializzazioni', 'quali specializzazioni', 'che specializzazioni', 'specializzazioni$', 'categorie', 'quali specialisti', 'all specialties', 'which specialties', 'specialties$', 'quali specialita', 'specialita$'],
            reply: function (c) {
                return { text: c.L('Sulla Home, sotto la barra di ricerca, trovi **Specializzazioni e Professioni Sanitarie** con tutte le categorie (dalla Cardiologia alla Psicologia, dalla Fisioterapia all\'Odontoiatria…), più le **Prestazioni e Trattamenti Frequenti**. Clicca una categoria per precompilare la ricerca.',
                    'On the Home page, below the search bar, you\'ll find **Specializzazioni e Professioni Sanitarie** with all the categories (from Cardiology to Psychology, Physiotherapy to Dentistry…), plus **Prestazioni e Trattamenti Frequenti**. Click a category to pre-fill the search.'),
                    actions: [A.show('specialties')] };
            }
        },
        {
            id: 'where_cities', prio: 4, terms: ['capoluogh', 'quali citta', 'elenco delle citta', 'tutte le citta', 'which cities', 'quali comuni', 'tutti i comuni', 'cap$', 'codice postale', 'postcode', 'zip code'],
            reply: function (c) {
                return { text: c.L('Puoi cercare per **comune o CAP** nella seconda casella. Sulla Home trovi anche l\'elenco dei **capoluoghi** con il relativo CAP: clicca una città per inserirla nella ricerca.',
                    'You can search by **city or postcode** in the second box. The Home page also lists the **provincial capitals** with their postcodes: click a city to put it into the search.'),
                    actions: [A.show('city'), A.show('cities')] };
            }
        },
        {
            id: 'chiedi', prio: 5, terms: ['chiedi al dottore', 'ask the doctor'],
            reply: function (c) { return { text: c.L('"Chiedi al Dottore" è una voce del menu in alto, ma non ho dettagli certi su come funzioni: ti consiglio di aprirla dal menu. Per cercare e prenotare un professionista, intanto, usa la ricerca in Home.', '"Chiedi al Dottore" is a top menu entry, but I have no reliable details about how it works: open it from the menu. Meanwhile, to find and book a professional use the search on the Home page.'), actions: [A.show('specialty')] }; }
        }
    ];

    var HEALTH_WORDS = ['dolore', 'dolori', 'febbre', 'sintom', 'male alla', 'male al ', 'mi fa male', 'tosse', 'nausea', 'malato', 'malessere', 'infezione', 'gonfior', 'prurito', 'farmaco', 'farmaci', 'medicina$', 'cura$', 'terapia', 'diagnosi', 'pain$', 'fever', 'symptom', 'cough', 'sick$', 'ache$', 'hurts'];

    function makeCtx(raw, mem) {
        var n = norm(raw);
        var lang = detectLang(n);
        return {
            raw: raw, n: n, lang: lang, mem: mem || {},
            L: function (it, en) { return lang === 'en' ? en : it; }
        };
    }

    function searchReply(c, spec, city, direct) {
        var short = shortSpec(spec);
        var where = city ? c.L(' a **' + city + '**', ' in **' + city + '**') : '';
        var text;
        if (direct) {
            text = c.L('Perfetto, ti preparo la ricerca per **' + short + '**' + where + '. Premi il pulsante qui sotto',
                'Great, I\'ll set up a search for **' + short + '**' + where + '. Press the button below');
            text += city ? c.L(' e vedrai i professionisti disponibili.', ' to see the available professionals.')
                : c.L(' e poi indica la città o il CAP nella seconda casella.', ' and then enter the city or postcode in the second box.');
        } else {
            text = c.L('Non posso fare diagnosi, ma per un disturbo di questo tipo ci si rivolge di solito a **' + short + '**' + where + '. In caso di dubbio il **medico di base** è sempre il primo riferimento. Se i sintomi sono forti o improvvisi chiama il 112.',
                'I can\'t give diagnoses, but for this kind of problem people usually see **' + short + '**' + where + '. If in doubt, your **GP** is always the first point of contact. If symptoms are severe or sudden, call 112.');
        }
        var actions = [A.search(spec, city)];
        if (!direct && spec.indexOf('Medicina Generale') !== 0) actions.push(A.search('Medicina Generale (Medico di Base / Famiglia)', city));
        if (direct && !city) actions.push(A.show('city'));
        return { text: text, actions: actions, memory: { specialty: spec, city: city || '' } };
    }

    function localAnswer(raw, mem) {
        var c = makeCtx(raw, mem);
        var n = c.n;
        if (!n) return { text: c.L('Scrivimi pure la tua domanda!', 'Go ahead and type your question!'), lang: c.lang };

        var em = emergencyReply(n, c.lang);
        if (em) { em.lang = c.lang; return em; }

        var words = n.split(' ').length;
        var spec = detectSpecialty(n);
        var city = detectCity(n);

        // punteggi degli intenti
        var best = null;
        for (var i = 0; i < INTENTS.length; i++) {
            var it = INTENTS[i];
            if (it.short && words > it.short) continue;
            var s = countTerms(n, it.terms);
            if (!s) continue;
            var score = s * 2 + it.prio * 0.1;
            if (!best || score > best.score) best = { intent: it, score: score };
        }

        var specScore = spec ? spec.score : 0;
        var searchVerbs = /(^| )(cerco|cercare|trovare|trovo|vorrei|serve|servirebbe|ho bisogno|looking|need|find|prenot|visita|visite)/.test(n);

        // 1) una specializzazione chiara batte gli intenti generici, ma non quelli "da sito" (registrazione, prezzi, login…)
        var siteIntent = best && ['register', 'plans', 'login', 'albo', 'password', 'myvisits', 'privacy', 'theme', 'support'].indexOf(best.intent.id) > -1;
        if (spec && !(siteIntent && !searchVerbs)) {
            if (spec.direct || searchVerbs || words <= 6) {
                var out = searchReply(c, spec.name, city, spec.direct);
                out.lang = c.lang;
                return out;
            }
        }
        // 2) risposta a una domanda sulla città: "e a Roma?"
        if (city && !spec && c.mem.specialty && words <= 6) {
            var out2 = searchReply(c, c.mem.specialty, city, true);
            out2.lang = c.lang;
            return out2;
        }
        // 3) intento riconosciuto
        if (best) {
            var r = best.intent.reply(c);
            r.lang = c.lang;
            r.intent = best.intent.id;
            if (r.chips === true) r.chips = c.lang === 'en' ? CHIPS_EN : CHIPS_IT;
            return r;
        }
        // 4) sintomo senza specializzazione chiara
        if (countTerms(n, HEALTH_WORDS)) {
            return {
                lang: c.lang,
                text: c.L('Mi dispiace per il disturbo. Non posso fare diagnosi né consigliare cure, ma posso aiutarti a trovare un professionista: il **medico di base** è il primo riferimento. Se i sintomi sono forti o improvvisi, chiama il **112**.',
                    'Sorry to hear that. I can\'t diagnose or recommend treatments, but I can help you find a professional: your **GP** is the first point of contact. If symptoms are severe or sudden, call **112**.'),
                actions: [A.search('Medicina Generale (Medico di Base / Famiglia)', city)]
            };
        }
        // 5) solo città, nessuna specializzazione nota
        if (city) {
            return {
                lang: c.lang,
                text: c.L('Ho capito la città (**' + city + '**). Che tipo di medico o specialista cerchi? Per esempio "dermatologo", "dentista" o "psicologo".',
                    'Got the city (**' + city + '**). What kind of doctor or specialist are you looking for? For example "dermatologist", "dentist" or "psychologist".'),
                memory: { specialty: '', city: city }, chips: false
            };
        }
        // 6) non ho capito
        return {
            lang: c.lang, chips: c.lang === 'en' ? CHIPS_EN : CHIPS_IT,
            text: c.L('Non sono sicuro di aver capito. Posso aiutarti a **trovare un medico**, **prenotare**, **registrarti** o **capire dove si trova qualcosa sul sito**. Prova a dirmelo con altre parole, oppure scegli un suggerimento.',
                'I\'m not sure I understood. I can help you **find a doctor**, **book a visit**, **sign up**, or **find where something is on the site**. Try rephrasing, or pick a suggestion.')
        };
    }

    // Esposto per i test e per il debug da console
    var api = { answer: localAnswer, norm: norm, SPECS: SPECS, TARGETS: TARGETS, PAGES: PAGES, actionLabel: actionLabel };
    root.ClickBot = api;
    if (typeof module === 'object' && module.exports) module.exports = api;

    if (typeof document === 'undefined') return;

    /* =====================================================================
     *  INTERFACCIA
     * ===================================================================== */
    function meta(name) {
        var m = document.querySelector('meta[name="' + name + '"]');
        return m ? (m.getAttribute('content') || '').trim() : '';
    }
    var SUPABASE_URL = meta('supabase-url');
    var SUPABASE_KEY = meta('supabase-key');
    var ENDPOINT = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/click-chat' : '';

    var STORE = 'pcd-click-chat';
    var SEEN = 'pcd-click-teaser';
    var MAX_SENT = 12;
    var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var state = { history: [], mem: {}, busy: false, serverDownUntil: 0, mode: 'idle' };
    try {
        var saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
        if (saved && saved.history) { state.history = saved.history; state.mem = saved.mem || {}; }
    } catch (e) { /* ignora */ }
    function persist() {
        try { sessionStorage.setItem(STORE, JSON.stringify({ history: state.history.slice(-24), mem: state.mem })); } catch (e) { /* ignora */ }
    }

    /* ---------- Stile ---------- */
    var css = '\
#click-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;padding:8px 18px 8px 8px;border-radius:999px;\
background:#0284c7;color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(2,132,199,.38);transition:background .2s,transform .2s}\
#click-fab:hover{background:#0369a1;transform:translateY(-2px)}\
#click-fab .ck-ava{width:38px;height:38px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}\
#click-fab .ck-ava img,#click-head .ck-ava img{width:30px;height:30px;object-fit:contain}\
#click-fab::before{content:"";position:absolute;inset:0;border-radius:999px;box-shadow:0 0 0 0 rgba(56,189,248,.65);animation:ck-pulse 3.2s ease-out infinite;pointer-events:none}\
@keyframes ck-pulse{0%{box-shadow:0 0 0 0 rgba(56,189,248,.6)}60%,100%{box-shadow:0 0 0 16px rgba(56,189,248,0)}}\
#click-teaser{position:fixed;right:24px;bottom:84px;z-index:9997;max-width:250px;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px 16px 4px 16px;\
padding:10px 30px 10px 14px;font:500 13.5px/1.4 Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(15,23,42,.18);animation:ck-pop .45s cubic-bezier(.2,.9,.3,1.3) both;cursor:pointer}\
#click-teaser button{position:absolute;top:4px;right:6px;border:0;background:transparent;color:#64748b;font-size:18px;cursor:pointer;line-height:1;padding:2px 5px}\
@keyframes ck-pop{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}\
#click-panel{position:fixed;right:20px;bottom:20px;z-index:9999;width:390px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 40px);display:none;flex-direction:column;\
background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 24px 60px rgba(15,23,42,.28);overflow:hidden;font-family:Inter,system-ui,sans-serif}\
#click-panel.open{display:flex;animation:ck-pop .3s ease both}\
#click-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff}\
#click-head .ck-ava{width:38px;height:38px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}\
#click-head b{display:block;font-size:15px;font-weight:700;line-height:1.2}\
#click-head small{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.92}\
#click-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block}\
#click-dot.ai{background:#4ade80}#click-dot.basic{background:#fbbf24}\
.ck-hbtn{background:transparent;border:0;color:#fff;cursor:pointer;border-radius:8px;padding:6px 8px;font-size:16px;line-height:1}\
.ck-hbtn:hover{background:rgba(255,255,255,.18)}\
#click-head .ck-sp{margin-left:auto;display:flex;gap:2px}\
#click-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;scroll-behavior:smooth}\
.ck-msg{max-width:90%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word;animation:ck-in .25s ease both}\
@keyframes ck-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}\
.ck-msg p{margin:0}.ck-msg p+p,.ck-msg p+ul,.ck-msg ul+p{margin-top:6px}\
.ck-msg ul{margin:0;padding-left:18px}.ck-msg li{margin:2px 0}\
.ck-bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px}\
.ck-user{align-self:flex-end;background:#0284c7;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}\
.ck-err{align-self:flex-start;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:16px;padding:10px 13px;font-size:13.5px}\
.ck-typing{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:16px;border-bottom-left-radius:4px;padding:12px 14px;display:flex;gap:4px}\
.ck-typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;display:block;animation:ck-bounce 1.1s infinite ease-in-out}\
.ck-typing i:nth-child(2){animation-delay:.15s}.ck-typing i:nth-child(3){animation-delay:.3s}\
@keyframes ck-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}\
.ck-actions,.ck-chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:96%}\
.ck-act{border:1px solid #0284c7;background:#fff;color:#0369a1;font:600 12.5px Inter,system-ui,sans-serif;padding:7px 12px;border-radius:999px;cursor:pointer;transition:background .15s,color .15s}\
.ck-act:hover{background:#0284c7;color:#fff}\
.ck-chip{border:1px solid #bae6fd;background:#f0f9ff;color:#0369a1;font:500 12.5px Inter,system-ui,sans-serif;padding:7px 11px;border-radius:999px;cursor:pointer}\
.ck-chip:hover{background:#e0f2fe}\
#click-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;align-items:flex-end}\
#click-input{flex:1;resize:none;border:1px solid #e2e8f0;border-radius:14px;padding:9px 12px;font:400 16px Inter,system-ui,sans-serif;max-height:110px;background:#f8fafc;color:#0f172a}\
#click-send{border:0;cursor:pointer;background:#0284c7;color:#fff;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;transition:background .2s,transform .15s}\
#click-send:hover{background:#0369a1;transform:scale(1.05)}#click-send:disabled{opacity:.5;cursor:not-allowed;transform:none}\
#click-send svg{width:18px;height:18px}\
#click-note{font-size:10.5px;color:#64748b;text-align:center;padding:0 12px 9px;background:#fff}\
#click-fab:focus-visible,#click-send:focus-visible,#click-input:focus-visible,.ck-hbtn:focus-visible,.ck-act:focus-visible,.ck-chip:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}\
.click-spot{outline:3px solid #38bdf8!important;outline-offset:4px;border-radius:12px;animation:ck-spot 1.2s ease-in-out 4}\
@keyframes ck-spot{0%{box-shadow:0 0 0 0 rgba(56,189,248,.75)}100%{box-shadow:0 0 0 18px rgba(56,189,248,0)}}\
#click-pointer{position:fixed;z-index:9990;background:#0284c7;color:#fff;font:600 12.5px Inter,system-ui,sans-serif;padding:6px 11px;border-radius:10px;pointer-events:none;box-shadow:0 8px 20px rgba(2,132,199,.4);animation:ck-float 1s ease-in-out infinite;white-space:nowrap}\
#click-pointer::before{content:"";position:absolute;top:-5px;left:50%;margin-left:-5px;border:5px solid transparent;border-top:0;border-bottom-color:#0284c7}\
@keyframes ck-float{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}\
@media (max-width:480px){#click-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:88dvh;max-height:88dvh;border-radius:22px 22px 0 0}#click-fab{right:14px;bottom:14px;padding:8px}#click-fab .ck-lbl{display:none}#click-teaser{right:14px;bottom:76px}}\
html.dark #click-panel,html.dark #click-teaser{background:#111b2f;color:#e2e8f0;border-color:#25324d}\
html.dark #click-log{background:#0b1220}\
html.dark .ck-bot,html.dark .ck-typing{background:#162239;border-color:#25324d;color:#e2e8f0}\
html.dark .ck-user{background:#0369a1}\
html.dark .ck-err{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.35);color:#fca5a5}\
html.dark .ck-act{background:transparent;border-color:#38bdf8;color:#7dd3fc}html.dark .ck-act:hover{background:#0284c7;color:#fff}\
html.dark .ck-chip{background:rgba(56,189,248,.10);border-color:rgba(56,189,248,.35);color:#7dd3fc}\
html.dark #click-form,html.dark #click-note{background:#111b2f;border-color:#25324d;color:#94a3b8}\
html.dark #click-input{background:#0b1220;border-color:#25324d;color:#e2e8f0}\
@media (prefers-reduced-motion:reduce){#click-fab::before,.click-spot,#click-pointer,.ck-typing i{animation:none}#click-fab,.ck-msg,#click-panel.open,#click-teaser{transition:none;animation:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    /* ---------- DOM ---------- */
    function el(tag, attrs, text) {
        var n = document.createElement(tag);
        if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
        if (text) n.textContent = text;
        return n;
    }
    function avatar() {
        var d = el('span', { 'class': 'ck-ava', 'aria-hidden': 'true' });
        var img = el('img', { src: 'favicon.png', alt: '' });
        d.appendChild(img);
        return d;
    }

    var fab = el('button', { id: 'click-fab', type: 'button', 'aria-label': 'Apri la chat con Click, l\'assistente del sito' });
    fab.appendChild(avatar());
    fab.appendChild(el('span', { 'class': 'ck-lbl' }, 'Chiedi a Click'));

    var panel = el('div', { id: 'click-panel', role: 'dialog', 'aria-label': 'Chat con Click' });
    var head = el('div', { id: 'click-head' });
    head.appendChild(avatar());
    var title = el('div');
    title.appendChild(el('b', null, 'Click'));
    var sub = el('small');
    var dot = el('span', { id: 'click-dot' });
    var subText = el('span', null, 'Assistente del sito');
    sub.appendChild(dot); sub.appendChild(subText);
    title.appendChild(sub);
    head.appendChild(title);
    var hsp = el('div', { 'class': 'ck-sp' });
    var resetBtn = el('button', { type: 'button', 'class': 'ck-hbtn', 'aria-label': 'Nuova conversazione', title: 'Nuova conversazione' }, '\u21BA');
    var closeBtn = el('button', { type: 'button', 'class': 'ck-hbtn', 'aria-label': 'Chiudi la chat', title: 'Chiudi' }, '\u00D7');
    closeBtn.style.fontSize = '22px';
    hsp.appendChild(resetBtn); hsp.appendChild(closeBtn);
    head.appendChild(hsp);

    var log = el('div', { id: 'click-log', 'aria-live': 'polite' });
    var form = el('form', { id: 'click-form' });
    var input = el('textarea', { id: 'click-input', rows: '1', maxlength: '1000', placeholder: 'Scrivi a Click\u2026', 'aria-label': 'Messaggio per Click' });
    var send = el('button', { id: 'click-send', type: 'submit', 'aria-label': 'Invia' });
    send.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>';
    form.appendChild(input); form.appendChild(send);
    var note = el('div', { id: 'click-note' }, 'Click \u00E8 un assistente automatico: non fa diagnosi e non sostituisce il medico. Emergenza? Chiama il 112.');

    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);

    function mount() {
        document.body.appendChild(fab);
        document.body.appendChild(panel);
        setTimeout(showTeaser, 3500);
        runUrlActions();
    }

    function setMode(mode) {
        state.mode = mode;
        dot.className = mode === 'ai' ? 'ai' : (mode === 'basic' ? 'basic' : '');
        dot.id = 'click-dot';
        subText.textContent = mode === 'ai' ? 'Assistente del sito \u00B7 IA attiva' : (mode === 'basic' ? 'Assistente del sito \u00B7 guida base' : 'Assistente del sito');
    }

    /* ---------- Testo ricco (senza innerHTML) ---------- */
    function inline(parent, text) {
        var parts = text.split(/(\*\*[^*]+\*\*)/);
        parts.forEach(function (p) {
            if (!p) return;
            if (/^\*\*[^*]+\*\*$/.test(p)) { var b = el('strong'); b.textContent = p.slice(2, -2); parent.appendChild(b); }
            else parent.appendChild(document.createTextNode(p));
        });
    }
    function renderRich(text) {
        var frag = document.createDocumentFragment();
        var lines = String(text || '').split('\n');
        var ul = null;
        lines.forEach(function (line) {
            var li = line.match(/^\s*(?:[-\u2022*])\s+(.*)$/);
            if (li) {
                if (!ul) { ul = el('ul'); frag.appendChild(ul); }
                var item = el('li'); inline(item, li[1]); ul.appendChild(item);
            } else if (line.trim()) {
                ul = null;
                var p = el('p'); inline(p, line.trim()); frag.appendChild(p);
            } else { ul = null; }
        });
        return frag;
    }
    // scrive il contenuto un po' alla volta, come una persona che digita
    function typeInto(container, frag, done) {
        container.appendChild(frag);
        if (reduceMotion) { done(); return; }
        var nodes = [], walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null), n;
        while ((n = walker.nextNode())) { nodes.push({ node: n, full: n.nodeValue }); n.nodeValue = ''; }
        var idx = 0, pos = 0;
        (function tick() {
            if (idx >= nodes.length) { done(); return; }
            var cur = nodes[idx];
            pos = Math.min(cur.full.length, pos + 3);
            cur.node.nodeValue = cur.full.slice(0, pos);
            log.scrollTop = log.scrollHeight;
            if (pos >= cur.full.length) { idx++; pos = 0; }
            setTimeout(tick, 14);
        })();
    }

    function scrollDown() { log.scrollTop = log.scrollHeight; }
    function userMsg(text) { var m = el('div', { 'class': 'ck-msg ck-user' }, text); log.appendChild(m); scrollDown(); }
    function errMsg(text) { var m = el('div', { 'class': 'ck-err' }, text); log.appendChild(m); scrollDown(); }

    function botMsg(text, actions, chips, lang, instant) {
        var m = el('div', { 'class': 'ck-msg ck-bot' });
        log.appendChild(m);
        var finish = function () {
            if (actions && actions.length) {
                var box = el('div', { 'class': 'ck-actions' });
                actions.forEach(function (a) {
                    var b = el('button', { type: 'button', 'class': 'ck-act' }, actionLabel(a, lang));
                    b.addEventListener('click', function () { runAction(a); });
                    box.appendChild(b);
                });
                log.appendChild(box);
            }
            if (chips && chips.length) showChips(chips);
            scrollDown();
        };
        var frag = renderRich(text);
        if (instant) { m.appendChild(frag); finish(); } else typeInto(m, frag, finish);
    }
    function showChips(list) {
        var old = document.getElementById('click-chips'); if (old) old.remove();
        var box = el('div', { id: 'click-chips', 'class': 'ck-chips' });
        list.forEach(function (q) {
            var c = el('button', { type: 'button', 'class': 'ck-chip' }, q);
            c.addEventListener('click', function () { ask(q); });
            box.appendChild(c);
        });
        log.appendChild(box);
    }
    function clearChips() { var c = document.getElementById('click-chips'); if (c) c.remove(); }

    function welcome() {
        botMsg('Ciao, sono **Click**! Ti aiuto a trovare ci\u00F2 che cerchi sul sito: medici, prenotazioni, registrazione\u2026 e posso anche **mostrarti dove si trova** ogni cosa. Cosa ti serve?', [], CHIPS_IT, 'it');
    }
    function restore() {
        log.innerHTML = '';
        if (!state.history.length) { welcome(); return; }
        state.history.forEach(function (m) {
            if (m.role === 'user') userMsg(m.content);
            else botMsg(m.content, m.actions, null, m.lang || 'it', true);
        });
    }

    /* ---------- Azioni sul sito ---------- */
    function pageKey() {
        var f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (f === '' || f === 'index.html') {
            var rv = document.getElementById('results-view');
            return rv && !rv.classList.contains('hidden') ? 'results' : 'home';
        }
        if (f.indexOf('paziente') > -1) return 'patient';
        if (f.indexOf('professionista') > -1) return 'professional';
        if (f.indexOf('centro') > -1) return 'center';
        return 'other';
    }
    function visible(e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); }
    function isNarrow() { return root.innerWidth <= 640; }

    function findTarget(key) {
        var t = TARGETS[key]; if (!t) return null;
        var found = null, i;
        for (i = 0; i < t.sel.length; i++) {
            var e = document.querySelector(t.sel[i]);
            if (visible(e)) { found = e; break; }
        }
        if (!found && t.mobile) {
            var btn = document.getElementById('mobile-menu-btn');
            if (visible(btn)) {
                if (typeof root.toggleMobileMenu === 'function') root.toggleMobileMenu(true);
                var m = document.querySelector(t.mobile);
                found = visible(m) ? (m.closest('button, a') || m) : btn;
            }
        } else if (found && t.menu) {
            var dd = document.getElementById(t.menu);
            if (dd && dd.classList.contains('hidden') && typeof root.toggleDropdown === 'function') root.toggleDropdown(t.menu);
        }
        return found;
    }

    var pointerTimer = null;
    function highlight(key) {
        var target = findTarget(key);
        if (!target) return false;
        document.querySelectorAll('.click-spot').forEach(function (x) { x.classList.remove('click-spot'); });
        var old = document.getElementById('click-pointer'); if (old) old.remove();
        clearTimeout(pointerTimer);
        target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        target.classList.add('click-spot');
        var tip = el('div', { id: 'click-pointer' }, 'Eccolo!');
        document.body.appendChild(tip);
        var t0 = Date.now();
        (function place() {
            if (!document.body.contains(tip)) return;
            var r = target.getBoundingClientRect();
            tip.style.left = Math.max(8, Math.min(root.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
            tip.style.top = Math.min(root.innerHeight - 40, r.bottom + 12) + 'px';
            if (Date.now() - t0 < 5200) requestAnimationFrame(place);
        })();
        pointerTimer = setTimeout(function () {
            target.classList.remove('click-spot');
            tip.remove();
        }, 5400);
        return true;
    }

    function runSearch(specialty, city) {
        var formEl = document.getElementById('search-form');
        if (formEl && typeof root.fillSpecialty === 'function') {
            root.fillSpecialty(specialty);
            if (city && typeof root.fillCity === 'function') root.fillCity(city);
            else { var loc = document.getElementById('location-input'); if (loc && !city) { /* lascia la città com'è */ } }
            if (typeof formEl.requestSubmit === 'function') formEl.requestSubmit();
            else formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        } else {
            var q = '?specialty=' + encodeURIComponent(specialty) + (city ? '&city=' + encodeURIComponent(city) : '');
            location.href = PAGES.home.file + q;
        }
    }

    function runAction(a) {
        if (isNarrow()) closePanel(true);
        setTimeout(function () {
            if (a.type === 'go' && PAGES[a.page]) {
                if (a.page === 'home' && pageKey() === 'home') { if (typeof root.showHomeView === 'function') root.showHomeView(); return; }
                location.href = PAGES[a.page].file;
            } else if (a.type === 'show') {
                if (!highlight(a.target)) location.href = PAGES.home.file + '?show=' + encodeURIComponent(a.target);
            } else if (a.type === 'login') {
                if (typeof root.openLoginModal === 'function') root.openLoginModal();
                else location.href = PAGES.home.file + '?login=1';
            } else if (a.type === 'search') {
                runSearch(a.specialty, a.city);
            }
        }, 80);   // dopo i gestori di click della pagina (che chiudono menu e tendine)
    }

    // Azioni richieste da un'altra pagina tramite l'indirizzo (?specialty=…&city=…, ?show=…, ?login=1)
    function runUrlActions() {
        var p;
        try { p = new URLSearchParams(location.search); } catch (e) { return; }
        var specialty = p.get('specialty'), city = p.get('city'), show = p.get('show'), login = p.get('login');
        if (!specialty && !show && !login) return;
        var go = function () {
            try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignora */ }
            if (specialty) runSearch(specialty.slice(0, 80), (city || '').slice(0, 60));
            else if (login && typeof root.openLoginModal === 'function') root.openLoginModal();
            else if (show && TARGETS[show]) setTimeout(function () { highlight(show); }, 400);
        };
        if (document.readyState === 'complete') setTimeout(go, 200);
        else root.addEventListener('load', function () { setTimeout(go, 300); });
    }

    /* ---------- Conversazione ---------- */
    function getSession() {
        try {
            if (root.supabase && root.supabase.auth) {
                return root.supabase.auth.getSession().then(function (r) { return (r && r.data && r.data.session) || null; }).catch(function () { return null; });
            }
        } catch (e) { /* ignora */ }
        return Promise.resolve(null);
    }

    var ACTION_TAG_PAGES = ['home', 'patient', 'professional', 'center'];
    function sanitizeActions(list) {
        var out = [];
        (list || []).forEach(function (a) {
            if (!a || out.length >= 3) return;
            if (a.type === 'go' && ACTION_TAG_PAGES.indexOf(a.page) > -1) out.push(A.go(a.page));
            else if (a.type === 'show' && TARGETS[a.target]) out.push(A.show(a.target));
            else if (a.type === 'login') out.push(A.login());
            else if (a.type === 'search' && typeof a.specialty === 'string' && a.specialty.length < 100) out.push(A.search(a.specialty, String(a.city || '').slice(0, 60)));
        });
        return out;
    }

    function askServer(session) {
        if (!ENDPOINT) return Promise.reject(new Error('no-endpoint'));
        var token = (session && session.access_token) || SUPABASE_KEY;
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
        var payload = {
            messages: state.history.slice(-MAX_SENT).map(function (m) { return { role: m.role, content: m.content }; }),
            context: { page: pageKey(), loggedIn: !!session }
        };
        return fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload),
            signal: ctrl ? ctrl.signal : undefined
        }).then(function (res) {
            clearTimeout(timer);
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok || !data.reply) { var e = new Error(data.error || 'server'); e.status = res.status; throw e; }
                return data;
            });
        }, function (e) { clearTimeout(timer); throw e; });
    }

    function answer(text) {
        var lastUser = text;
        var useServer = ENDPOINT && Date.now() > state.serverDownUntil;
        // le emergenze non aspettano il server
        var em = emergencyReply(norm(text), detectLang(norm(text)));
        if (em) { em.lang = detectLang(norm(text)); return Promise.resolve(em); }

        var viaLocal = function () {
            var r = localAnswer(lastUser, state.mem);
            if (r.memory) state.mem = r.memory;
            setMode('basic');
            return r;
        };
        if (!useServer) return Promise.resolve(viaLocal());
        return getSession().then(askServer).then(function (data) {
            setMode('ai');
            var lang = detectLang(norm(text));
            var sacts = sanitizeActions(data.actions);
            // ricorda specializzazione/città per le domande successive
            sacts.forEach(function (a) { if (a.type === 'search') state.mem = { specialty: a.specialty, city: a.city }; });
            return { text: data.reply, actions: sacts, lang: lang };
        }).catch(function () {
            state.serverDownUntil = Date.now() + 90000;   // non insiste per un po' se il server non risponde
            return viaLocal();
        });
    }

    function ask(text) {
        text = (text || '').trim().slice(0, 1000);
        if (!text || state.busy) return;
        state.busy = true; send.disabled = true;
        clearChips();
        state.history.push({ role: 'user', content: text });
        userMsg(text);
        input.value = ''; input.style.height = 'auto';

        var typing = el('div', { 'class': 'ck-typing', 'aria-label': 'Click sta scrivendo' });
        typing.appendChild(el('i')); typing.appendChild(el('i')); typing.appendChild(el('i'));
        log.appendChild(typing); scrollDown();

        var started = Date.now();
        answer(text).then(function (r) {
            var wait = Math.max(0, 450 - (Date.now() - started));   // un attimo di "pensiero", anche se la risposta è istantanea
            return new Promise(function (res) { setTimeout(function () { res(r); }, reduceMotion ? 0 : wait); });
        }).then(function (r) {
            typing.remove();
            state.history.push({ role: 'assistant', content: r.text, actions: r.actions || [], lang: r.lang });
            persist();
            botMsg(r.text, r.actions, r.chips, r.lang || 'it');
        }).catch(function () {
            typing.remove();
            state.history.pop();
            errMsg('Qualcosa \u00E8 andato storto. Riprova tra un attimo.');
        }).then(function () {
            state.busy = false; send.disabled = false;
            if (!isNarrow()) input.focus();
        });
    }

    /* ---------- Apertura / chiusura ---------- */
    function openPanel() {
        hideTeaser();
        panel.classList.add('open');
        fab.style.display = 'none';
        if (!log.childNodes.length) restore();
        if (!isNarrow()) input.focus();
        scrollDown();
    }
    function closePanel(keepFocus) {
        panel.classList.remove('open');
        fab.style.display = '';
        if (!keepFocus) fab.focus();
    }

    var teaser = null;
    function showTeaser() {
        if (panel.classList.contains('open') || teaser) return;
        try { if (sessionStorage.getItem(SEEN)) return; sessionStorage.setItem(SEEN, '1'); } catch (e) { /* ignora */ }
        teaser = el('div', { id: 'click-teaser', role: 'status' });
        teaser.appendChild(document.createTextNode('Ciao, sono Click! Ti aiuto a trovare ci\u00F2 che cerchi sul sito. \uD83D\uDC4B'));
        var x = el('button', { type: 'button', 'aria-label': 'Chiudi' }, '\u00D7');
        x.addEventListener('click', function (e) { e.stopPropagation(); hideTeaser(); });
        teaser.appendChild(x);
        teaser.addEventListener('click', openPanel);
        document.body.appendChild(teaser);
        setTimeout(hideTeaser, 9000);
    }
    function hideTeaser() { if (teaser) { teaser.remove(); teaser = null; } }

    fab.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', function () { closePanel(false); });
    resetBtn.addEventListener('click', function () {
        state.history = []; state.mem = {}; persist(); log.innerHTML = ''; welcome();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) closePanel(false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    });

    // piccolo aiuto da console: ClickBot.open()
    api.open = openPanel; api.close = closePanel; api.highlight = highlight; api.ask = ask;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})(typeof window !== 'undefined' ? window : globalThis);
