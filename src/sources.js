// Médias autorisés. Aucune actualité ne provient d'un autre site.
//
// Chaque média est lu directement sur son site :
// - rss     : son flux RSS officiel
// - domaine : seuls les liens vers ce site sont acceptés
//
// Chaque article est ensuite vérifié (voir src/verification.js) : seuls les articles
// gratuits et d'au moins 5 minutes de lecture sont proposés à l'IA.

const SOURCES = [
    // Francophones
    { nom: "L'ADN", rss: "https://www.ladn.eu/feed/", domaine: "ladn.eu" },
    { nom: "E-marketing", rss: "https://www.e-marketing.fr/feed", domaine: "e-marketing.fr" },
    { nom: "La Réclame", rss: "https://lareclame.fr/feed", domaine: "lareclame.fr" },
    { nom: "The Media Leader", rss: "https://fr.themedialeader.com/feed/", domaine: "themedialeader.com" },
    { nom: "Journal du Net", rss: "https://www.journaldunet.com/ebusiness/publicite/rss/", domaine: "journaldunet.com" },
    { nom: "Blog du Modérateur", rss: "https://www.blogdumoderateur.com/feed/", domaine: "blogdumoderateur.com" },
    { nom: "Webmarketing & co'm", rss: "https://www.webmarketing-com.com/feed", domaine: "webmarketing-com.com" },
    { nom: "Abondance", rss: "https://www.abondance.com/feed", domaine: "abondance.com" },

    // Anglophones
    { nom: "Digiday", rss: "https://digiday.com/feed/", domaine: "digiday.com" },
    { nom: "Search Engine Journal", rss: "https://www.searchenginejournal.com/feed/", domaine: "searchenginejournal.com" },
    { nom: "HubSpot", rss: "https://blog.hubspot.com/marketing/rss.xml", domaine: "hubspot.com" },
    { nom: "Moz", rss: "https://moz.com/posts/rss/blog", domaine: "moz.com" },

    // Retirés : articles presque toujours payants, trop courts, ou site illisible automatiquement.
    // Stratégies, CB News, INfluencia, Adweek, Ad Age, Campaign, PRWeek, Marketing Week,
    // Search Engine Land, The Drum, WARC, Contagious.
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
