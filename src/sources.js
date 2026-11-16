// Médias autorisés. Aucune actualité ne provient d'un autre site.
//
// Chaque média est lu directement sur son site, par :
// - rss     : son flux RSS officiel
// - sitemap : son plan de site, quand il n'a pas de flux RSS
// - domaine : seuls les liens vers ce site sont acceptés
//
// Chaque article est ensuite vérifié (voir src/verification.js) : seuls les articles
// gratuits et d'au moins 5 minutes de lecture sont proposés à l'IA.

const SOURCES = [
    // Francophones
    { nom: "Stratégies", sitemap: "https://www.strategies.fr/news-sitemap.xml", domaine: "strategies.fr" },
    { nom: "CB News", rss: "https://www.cbnews.fr/rss.xml", domaine: "cbnews.fr" },
    { nom: "INfluencia", sitemap: "https://www.influencia.net/sitemap.xml", domaine: "influencia.net" },
    { nom: "L'ADN", rss: "https://www.ladn.eu/feed/", domaine: "ladn.eu" },
    { nom: "E-marketing", rss: "https://www.e-marketing.fr/feed", domaine: "e-marketing.fr" },
    { nom: "La Réclame", rss: "https://lareclame.fr/feed", domaine: "lareclame.fr" },
    { nom: "The Media Leader", rss: "https://fr.themedialeader.com/feed/", domaine: "themedialeader.com" },
    { nom: "Journal du Net", rss: "https://www.journaldunet.com/ebusiness/publicite/rss/", domaine: "journaldunet.com" },
    { nom: "Blog du Modérateur", rss: "https://www.blogdumoderateur.com/feed/", domaine: "blogdumoderateur.com" },

    // Anglophones
    { nom: "Adweek", rss: "https://www.adweek.com/feed/", domaine: "adweek.com" },
    { nom: "Ad Age", sitemap: "https://adage.com/arc/outboundfeeds/sitemap-news/latest/", domaine: "adage.com" },
    { nom: "Campaign", rss: "https://www.campaignlive.com/rss/news", domaine: "campaignlive.com" },
    { nom: "Marketing Week", rss: "https://www.marketingweek.com/feed/", domaine: "marketingweek.com" },
    { nom: "Digiday", rss: "https://digiday.com/feed/", domaine: "digiday.com" },
    { nom: "PRWeek", rss: "https://www.prweek.com/uk/rss/news", domaine: "prweek.com" },
    { nom: "Search Engine Land", rss: "https://searchengineland.com/feed", domaine: "searchengineland.com" },

    // Non lus pour l'instant : pas de flux accessible, ou articles réservés aux abonnés.
    // { nom: "The Drum", domaine: "thedrum.com" },      // bloque la lecture automatique de son site
    // { nom: "WARC", domaine: "warc.com" },             // articles réservés aux abonnés
    // { nom: "Contagious", domaine: "contagious.com" }, // articles réservés aux abonnés
];

// Thèmes prioritaires, dans l'ordre d'affichage. L'emoji est affiché devant le titre
// de chaque actualité. Un sujet important hors de ces thèmes reçoit EMOJI_AUTRE.
const THEMES = [
    { nom: "IA & marketing", emoji: "🤖" },
    { nom: "Data", emoji: "📊" },
    { nom: "SEO", emoji: "🔎" },
    { nom: "RP", emoji: "📣" },
];
const EMOJI_AUTRE = "📌";

// Nombre d'actualités dans la revue de presse.
const NB_ACTUS_MIN = 7;
const NB_ACTUS_MAX = 8;

module.exports = { SOURCES, THEMES, EMOJI_AUTRE, NB_ACTUS_MIN, NB_ACTUS_MAX };
