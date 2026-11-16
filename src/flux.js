// Récupération et lecture des flux RSS des médias.

// Un peu plus de 24 h pour ne rien rater entre deux envois.
// Le lundi, on couvre aussi le week-end (peu de publications le samedi et le dimanche).
const FENETRE_HEURES = 26;
const FENETRE_HEURES_LUNDI = 74;
const MAX_PAR_SOURCE = 8;
const TIMEOUT_MS = 15000;
const USER_AGENT = "Mozilla/5.0 (compatible; BabyJournalist/2.0; +https://github.com/kisyaaaa/TelegramAgent-BabyJournalist)";

const GOOGLE_NEWS_LANGUES = {
    fr: "hl=fr&gl=FR&ceid=FR:fr",
    en: "hl=en-US&gl=US&ceid=US:en",
    de: "hl=de-CH&gl=CH&ceid=CH:de",
};

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

function analyserFlux(xml) {
    const blocs = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
    return blocs.map((bloc) => {
        const date = new Date(nettoyer(lireBalise(bloc, "pubDate", "dc:date", "published", "updated")));
        return {
            titre: nettoyer(lireBalise(bloc, "title")),
            description: nettoyer(lireBalise(bloc, "description", "summary", "content:encoded")).slice(0, 400),
            lien: lireLien(bloc),
            date: isNaN(date) ? null : date,
        };
    });
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

function garderRecents(articles, source) {
    const heures = estLundiEnSuisse() ? FENETRE_HEURES_LUNDI : FENETRE_HEURES;
    const limite = Date.now() - heures * 3600 * 1000;
    return articles
        .filter((a) => a.titre && a.lien && a.date && a.date.getTime() >= limite)
        .sort((a, b) => b.date - a.date)
        .slice(0, MAX_PAR_SOURCE)
        .map((a) => ({ ...a, source: source.nom }));
}

async function lireViaRss(source) {
    return garderRecents(analyserFlux(await telecharger(source.rss)), source);
}

async function lireViaGoogleNews(source) {
    const params = GOOGLE_NEWS_LANGUES[source.langue] || GOOGLE_NEWS_LANGUES.fr;
    const periode = estLundiEnSuisse() ? "3d" : "1d";
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${source.domaine} when:${periode}`)}&${params}`;
    const articles = analyserFlux(await telecharger(url)).map((a) => ({
        ...a,
        titre: a.titre.replace(/\s+-\s+[^-]+$/, ""), // retire le " - Nom du média" ajouté par Google
        description: "", // Google News ne fournit que le titre
    }));
    return garderRecents(articles, source);
}

// Lit une source : flux RSS officiel d'abord, Google News (filtré sur le site) en secours.
async function lireSource(source) {
    if (source.rss) {
        try {
            const articles = await lireViaRss(source);
            if (articles.length > 0) return { articles, mode: "rss" };
        } catch (err) {
            console.warn(`   ⚠️ ${source.nom} : flux RSS indisponible (${err.message})`);
        }
    }
    try {
        return { articles: await lireViaGoogleNews(source), mode: "google" };
    } catch (err) {
        console.warn(`   ⚠️ ${source.nom} : Google News indisponible (${err.message})`);
        return { articles: [], mode: "echec" };
    }
}

function cleTitre(titre) {
    return titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

// Récupère tous les articles récents de toutes les sources, sans doublons.
async function recupererArticles(sources) {
    const resultats = await Promise.all(sources.map(lireSource));
    const vus = new Set();
    const articles = [];

    resultats.forEach(({ articles: liste, mode }, i) => {
        console.log(`   ${mode === "echec" ? "❌" : "✅"} ${sources[i].nom} : ${liste.length} article(s) [${mode}]`);
        for (const a of liste) {
            const cle = cleTitre(a.titre);
            if (vus.has(a.lien) || vus.has(cle)) continue;
            vus.add(a.lien);
            vus.add(cle);
            articles.push(a);
        }
    });

    // Du plus récent au plus ancien : si la liste est tronquée, on perd les plus anciens.
    return articles.sort((a, b) => b.date - a.date).map((a, id) => ({ id, ...a }));
}

module.exports = { recupererArticles, analyserFlux, nettoyer };
