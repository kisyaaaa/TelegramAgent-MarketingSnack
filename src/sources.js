// Liste des médias autorisés. Aucune actualité ne provient d'un autre site.
//
// - rss    : flux RSS officiel du média (essayé en premier)
// - domaine: utilisé en secours via Google News, filtré sur ce seul site
// - langue : langue du média (pour la recherche Google News)

const SOURCES = [
    // Francophones
    { nom: "Stratégies", domaine: "strategies.fr", langue: "fr" },
    { nom: "CB News", rss: "https://www.cbnews.fr/rss.xml", domaine: "cbnews.fr", langue: "fr" },
    { nom: "INfluencia", domaine: "influencia.net", langue: "fr" },
    { nom: "L'ADN", rss: "https://www.ladn.eu/feed/", domaine: "ladn.eu", langue: "fr" },
    { nom: "E-marketing", rss: "https://www.e-marketing.fr/feed", domaine: "e-marketing.fr", langue: "fr" },
    { nom: "La Réclame", rss: "https://lareclame.fr/feed", domaine: "lareclame.fr", langue: "fr" },
    { nom: "The Media Leader", rss: "https://fr.themedialeader.com/feed/", domaine: "themedialeader.com", langue: "fr" },
    { nom: "Journal du Net", rss: "https://www.journaldunet.com/ebusiness/publicite/rss/", domaine: "journaldunet.com", langue: "fr" },
    { nom: "Blog du Modérateur", rss: "https://www.blogdumoderateur.com/feed/", domaine: "blogdumoderateur.com", langue: "fr" },

    // Germanophone (Suisse)
    { nom: "persoenlich.com", rss: "https://www.persoenlich.com/rss/news.xml", domaine: "persoenlich.com", langue: "de" },

    // Anglophones
    { nom: "Adweek", rss: "https://www.adweek.com/feed/", domaine: "adweek.com", langue: "en" },
    { nom: "Ad Age", domaine: "adage.com", langue: "en" },
    { nom: "Campaign", rss: "https://www.campaignlive.com/rss/news", domaine: "campaignlive.com", langue: "en" },
    { nom: "The Drum", domaine: "thedrum.com", langue: "en" },
    { nom: "Marketing Week", rss: "https://www.marketingweek.com/feed/", domaine: "marketingweek.com", langue: "en" },
    { nom: "Digiday", rss: "https://digiday.com/feed/", domaine: "digiday.com", langue: "en" },
    { nom: "WARC", domaine: "warc.com", langue: "en" },
    { nom: "Contagious", domaine: "contagious.com", langue: "en" },
    { nom: "PRWeek", domaine: "prweek.com", langue: "en" },
    { nom: "Search Engine Land", rss: "https://searchengineland.com/feed", domaine: "searchengineland.com", langue: "en" },
];

// Thèmes de la revue de presse, dans l'ordre d'affichage.
const THEMES = [
    { nom: "IA & marketing", emoji: "🤖" },
    { nom: "Data", emoji: "📊" },
    { nom: "SEO", emoji: "🔎" },
    { nom: "RP", emoji: "📣" },
    { nom: "Marketing", emoji: "🎯" },
];

// Nombre d'actualités dans la revue de presse.
const NB_ACTUS_MIN = 7;
const NB_ACTUS_MAX = 8;

module.exports = { SOURCES, THEMES, NB_ACTUS_MIN, NB_ACTUS_MAX };
