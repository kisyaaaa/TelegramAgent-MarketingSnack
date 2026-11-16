// Récupération des articles récents publiés par les médias suivis.
// Chaque média est lu par son flux RSS ou par son plan de site (sitemap), directement
// sur son propre site : les liens mènent donc toujours à l'article d'origine.

// Un peu plus de 24 h pour ne rien rater entre deux envois.
// Le lundi, on couvre aussi le week-end (peu de publications le samedi et le dimanche).
const FENETRE_HEURES = 26;
const FENETRE_HEURES_LUNDI = 74;
const MAX_PAR_SOURCE = 12;
const TIMEOUT_MS = 20000;
const USER_AGENT = "Mozilla/5.0 (compatible; BabyJournalist/2.0; +https://github.com/kisyaaaa/TelegramAgent-BabyJournalist)";

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

function decoderEntites(texte) {
    return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code) => {
        if (code[0] === "#") {
            const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(n) ? String.fromCodePoint(n) : tout;
        }
        return ENTITES[code.toLowerCase()] ?? tout;
    });
}

function nettoyer(texte) {
    if (!texte) return "";
    let t = texte.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    t = decoderEntites(t); // les descriptions contiennent souvent du HTML encodé
    t = t.replace(/<[^>]+>/g, " ");
    t = decoderEntites(t);
    return t.replace(/\s+/g, " ").trim();
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

function lireBalise(xml, ...noms) {
    for (const nom of noms) {
        const m = xml.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, "i"));
        if (m && m[1].trim()) return m[1];
    }
    return "";
}

function lireLien(xml) {
    const texte = nettoyer(lireBalise(xml, "link"));
    if (texte.startsWith("http")) return texte;
    const atom = xml.match(/<link[^>]*href="([^"]+)"/i); // format Atom
    return atom ? decoderEntites(atom[1]) : "";
}

function lireDate(texte) {
    const d = new Date(nettoyer(texte));
    return isNaN(d) ? null : d;
}

// Flux RSS ou Atom.
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

// Plan de site (sitemap), avec ou sans extension "Google News".
function analyserSitemap(xml) {
    return xml
        .split(/<url>/i)
        .slice(1)
        .map((bloc) => ({
            titre: nettoyer(lireBalise(bloc, "news:title")), // vide si absent : lu sur la page ensuite
            description: "",
            lien: nettoyer(lireBalise(bloc, "loc")),
            date: lireDate(lireBalise(bloc, "news:publication_date", "lastmod")),
        }));
}

async function telecharger(url) {
    const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

function estLundiEnSuisse() {
    return new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", weekday: "short" }).format(new Date()) === "Mon";
}

function hote(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

// Vrai si l'URL appartient bien au site du média (ex. "fr.themedialeader.com" pour "themedialeader.com").
function estSurLeSite(url, domaine) {
    const h = hote(url);
    return h === domaine || h.endsWith(`.${domaine}`);
}

function garderRecents(articles, source) {
    const heures = estLundiEnSuisse() ? FENETRE_HEURES_LUNDI : FENETRE_HEURES;
    const limite = Date.now() - heures * 3600 * 1000;
    return articles
        .filter((a) => estSurLeSite(a.lien, source.domaine)) // uniquement des liens vers le site du média
        .filter((a) => a.date && a.date.getTime() >= limite)
        .sort((a, b) => b.date - a.date)
        .slice(0, MAX_PAR_SOURCE)
        .map((a) => ({ ...a, source: source.nom }));
}

async function lireSource(source) {
    try {
        const xml = await telecharger(source.rss || source.sitemap);
        const articles = source.rss ? analyserFlux(xml) : analyserSitemap(xml);
        return { articles: garderRecents(articles, source), erreur: null };
    } catch (err) {
        return { articles: [], erreur: err.name === "TimeoutError" ? "délai dépassé" : err.message };
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
            const cles = [a.lien, a.titre && cleTitre(a.titre)].filter(Boolean);
            if (cles.some((c) => vus.has(c))) continue;
            cles.forEach((c) => vus.add(c));
            articles.push(a);
        }
    });

    return articles.sort((a, b) => b.date - a.date);
}

module.exports = { recupererArticles, analyserFlux, analyserSitemap, estSurLeSite, decoderEntites };
