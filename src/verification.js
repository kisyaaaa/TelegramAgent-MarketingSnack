// Vérification de chaque article avant sélection : on télécharge la page, comme le ferait
// une personne sans abonnement, et on ne garde que les articles :
//   - accessibles gratuitement (pas de paywall),
//   - complets, d'au moins 5 minutes de lecture.

const MOTS_MIN = 1000; // ≈ 5 min de lecture à 200 mots par minute
const MOTS_PAR_MINUTE = 200;
const MOTS_PAR_PARAGRAPHE_MIN = 12; // ignore menus, légendes, boutons...
const TIMEOUT_MS = 15000;
const EN_PARALLELE = 6;
const USER_AGENT = "Mozilla/5.0 (compatible; BabyJournalist/2.0; +https://github.com/kisyaaaa/TelegramAgent-BabyJournalist)";

// Textes affichés par les sites quand la suite de l'article est réservée aux abonnés.
const SIGNES_PAYWALL = [
    /réservé aux abonnés/i,
    /article réservé/i,
    /contenu réservé/i,
    /pour lire la suite/i,
    /la suite est réservée/i,
    /subscribe to (continue|read)/i,
    /subscribers? only/i,
    /this (article|content) is for (subscribers|members)/i,
    /already a subscriber\?/i,
];

const { decoderEntites } = require("./flux");

function decoder(texte) {
    return decoderEntites(texte).replace(/ /g, " ");
}

function compterMots(texte) {
    return texte.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length;
}

// Paragraphes du corps de l'article (dans <article> si la page en a un).
function extraireParagraphes(html) {
    const sansScripts = html.replace(/<(script|style|noscript|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ");
    const zones = [...sansScripts.matchAll(/<article[\s\S]*?<\/article>/gi)].map((m) => m[0]);
    const lire = (zone) =>
        [...zone.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map((m) => decoder(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
            .filter((p) => compterMots(p) >= MOTS_PAR_PARAGRAPHE_MIN);

    const dansArticle = zones.flatMap(lire);
    if (compterMots(dansArticle.join(" ")) >= 150) return dansArticle;
    return lire(sansScripts); // pas de balise <article> exploitable : toute la page
}

function lireMeta(html, nom) {
    const m =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nom}["'][^>]+content=["']([^"']*)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${nom}["']`, "i"));
    return m ? decoder(m[1]).trim() : "";
}

// Analyse une page d'article. Exporté pour pouvoir être testé seul.
function analyserPage(html) {
    // Balise standard (schema.org) que les sites à paywall utilisent pour le signaler à Google.
    const accesLibre = html.match(/"isAccessibleForFree"\s*:\s*"?(true|false)"?/i);
    const paywallDeclare = accesLibre && accesLibre[1].toLowerCase() === "false";

    const paragraphes = extraireParagraphes(html);
    const texte = paragraphes.join("\n");
    const mots = compterMots(texte);
    const paywallVisible = SIGNES_PAYWALL.some((re) => re.test(texte.slice(-1500)) || re.test(lireMeta(html, "description")));

    return {
        gratuit: !paywallDeclare && !paywallVisible,
        mots,
        minutes: Math.round(mots / MOTS_PAR_MINUTE),
        texte,
        titre: lireMeta(html, "og:title"),
        description: lireMeta(html, "og:description") || lireMeta(html, "description"),
    };
}

async function verifierArticle(article) {
    try {
        const res = await fetch(article.lien, {
            headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
            redirect: "follow",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return { ...article, refus: `page inaccessible (HTTP ${res.status})` };
        const page = analyserPage(await res.text());

        if (!page.gratuit) return { ...article, refus: "payant" };
        if (page.mots < MOTS_MIN) return { ...article, refus: `trop court (${page.mots} mots)` };

        return {
            ...article,
            lien: res.url || article.lien, // adresse finale après redirection
            titre: article.titre || page.titre,
            description: article.description || page.description,
            texte: page.texte,
            minutes: page.minutes,
        };
    } catch (err) {
        return { ...article, refus: `page inaccessible (${err.name === "TimeoutError" ? "délai dépassé" : err.message})` };
    }
}

// Vérifie tous les articles (quelques-uns à la fois) et ne renvoie que ceux qui sont valides.
async function verifierArticles(articles) {
    const resultats = new Array(articles.length);
    let suivant = 0;
    async function travailleur() {
        while (suivant < articles.length) {
            const i = suivant++;
            resultats[i] = await verifierArticle(articles[i]);
        }
    }
    await Promise.all(Array.from({ length: EN_PARALLELE }, travailleur));

    // Résumé par média dans les logs.
    const bilan = {};
    for (const r of resultats) {
        const b = (bilan[r.source] ||= { ok: 0, payant: 0, court: 0, inaccessible: 0 });
        if (!r.refus) b.ok++;
        else if (r.refus === "payant") b.payant++;
        else if (r.refus.startsWith("trop court")) b.court++;
        else b.inaccessible++;
    }
    for (const [source, b] of Object.entries(bilan)) {
        console.log(`   ${b.ok ? "✅" : "➖"} ${source} : ${b.ok} retenu(s) · ${b.payant} payant(s) · ${b.court} trop court(s) · ${b.inaccessible} inaccessible(s)`);
    }

    return resultats.filter((r) => !r.refus && r.titre);
}

module.exports = { verifierArticles, analyserPage, MOTS_MIN };
