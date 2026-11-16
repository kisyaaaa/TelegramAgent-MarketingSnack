// Récupération des articles récents publiés par les médias suivis.
// Chaque média est lu par son flux RSS, directement sur son propre site :
// les liens mènent donc toujours à l'article d'origine.

const { telecharger, decoderEntites, texteBrut } = require("./web");

// Un peu plus de 24 h pour ne rien rater entre deux envois.
// Le lundi, on couvre aussi le week-end (peu de publications le samedi et le dimanche).
const FENETRE_HEURES = 26;
const FENETRE_HEURES_LUNDI = 74;
const MAX_PAR_SOURCE = 12;

function nettoyer(xml) {
    return texteBrut(xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

// Retire les phrases ajoutées automatiquement (WordPress, Instagram) dans les extraits.
function retirerMentionsAuto(texte) {
    return texte
        .replace(/\s*The post .* appeared first on .*$/i, "")
        .replace(/Voir cette publication sur Instagram|Une publication partagée par [^:]*:?/gi, " ")
        .replace(/\s*(…|\.\.\.)?\s*(Continuer la lecture|Lire la suite|Read more)\s*(→|»)?.*$/i, "…")
        .replace(/\s+/g, " ")
        .trim();
}

// Contenu de la première balise trouvée parmi `noms` (ex. "pubDate" puis "published").
function lireBalise(xml, ...noms) {
    for (const nom of noms) {
        const m = xml.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, "i"));
        if (m && m[1].trim()) return m[1];
    }
    return "";
}

// Retire les paramètres de suivi publicitaire (utm_source, utm_medium...) des liens.
function sansSuivi(lien) {
    try {
        const url = new URL(lien);
        [...url.searchParams.keys()].filter((cle) => cle.startsWith("utm_")).forEach((cle) => url.searchParams.delete(cle));
        return url.toString();
    } catch {
        return lien;
    }
}

function lireLien(xml) {
    const texte = nettoyer(lireBalise(xml, "link"));
    const atom = xml.match(/<link[^>]*href="([^"]+)"/i); // format Atom
    const lien = texte.startsWith("http") ? texte : atom ? decoderEntites(atom[1]) : "";
    return sansSuivi(lien);
}

function lireDate(xml) {
    const d = new Date(nettoyer(xml));
    return isNaN(d) ? null : d;
}

// Lit un flux RSS ou Atom.
function analyserFlux(xml) {
    return xml
        .split(/<item[\s>]|<entry[\s>]/i)
        .slice(1)
        .map((bloc) => ({
            titre: nettoyer(lireBalise(bloc, "title")),
            description: retirerMentionsAuto(nettoyer(lireBalise(bloc, "description", "summary"))).slice(0, 400),
            lien: lireLien(bloc),
            date: lireDate(lireBalise(bloc, "pubDate", "dc:date", "published", "updated")),
        }));
}

function estLundiEnSuisse() {
    return new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", weekday: "short" }).format(new Date()) === "Mon";
}

// Vrai si l'URL appartient bien au site du média (ex. "fr.themedialeader.com" pour "themedialeader.com").
function estSurLeSite(url, domaine) {
    try {
        const hote = new URL(url).hostname;
        return hote === domaine || hote.endsWith(`.${domaine}`);
    } catch {
        return false;
    }
}

function garderRecents(articles, source) {
    const heures = estLundiEnSuisse() ? FENETRE_HEURES_LUNDI : FENETRE_HEURES;
    const limite = Date.now() - heures * 3600 * 1000;
    return articles
        .filter((a) => a.titre && estSurLeSite(a.lien, source.domaine)) // uniquement des liens vers le site du média
        .filter((a) => a.date && a.date.getTime() >= limite)
        .sort((a, b) => b.date - a.date)
        .slice(0, MAX_PAR_SOURCE)
        .map((a) => ({ ...a, source: source.nom }));
}

async function lireSource(source) {
    try {
        const { texte } = await telecharger(source.rss);
        return { articles: garderRecents(analyserFlux(texte), source) };
    } catch (err) {
        return { articles: [], erreur: err.message };
    }
}

function cleTitre(titre) {
    return titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

// Récupère les articles récents de toutes les sources, sans doublons, du plus récent au plus ancien.
async function recupererArticles(sources) {
    const resultats = await Promise.all(sources.map(lireSource));
    const vus = new Set();
    const articles = [];

    resultats.forEach(({ articles: liste, erreur }, i) => {
        if (erreur) console.warn(`   ❌ ${sources[i].nom} : inaccessible (${erreur})`);
        else console.log(`   📥 ${sources[i].nom} : ${liste.length} article(s) récent(s)`);

        for (const a of liste) {
            // Doublon si même lien ou même titre (articles republiés dans plusieurs rubriques).
            if (vus.has(a.lien) || vus.has(cleTitre(a.titre))) continue;
            vus.add(a.lien);
            vus.add(cleTitre(a.titre));
            articles.push(a);
        }
    });

    return articles.sort((a, b) => b.date - a.date);
}

module.exports = { recupererArticles };
