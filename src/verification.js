// Vérification de chaque article avant sélection : on télécharge la page, comme le ferait
// une personne sans abonnement, et on ne garde que les articles :
//   - accessibles gratuitement (pas de paywall),
//   - complets, d'au moins 5 minutes de lecture.

const { telecharger, texteBrut } = require("./web");

const MOTS_MIN = 1000; // ≈ 5 min de lecture à 200 mots par minute
const MOTS_PAR_MINUTE = 200;
const MOTS_PAR_PARAGRAPHE_MIN = 12; // ignore menus, légendes, boutons...
const EN_PARALLELE = 6;

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

function compterMots(texte) {
    return texte.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length;
}

// Paragraphes du corps de l'article (dans <article> si la page en a un).
function extraireParagraphes(html) {
    const sansScripts = html.replace(/<(script|style|noscript|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ");
    const lire = (zone) =>
        [...zone.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map((m) => texteBrut(m[1]))
            .filter((p) => compterMots(p) >= MOTS_PAR_PARAGRAPHE_MIN);

    const zonesArticle = [...sansScripts.matchAll(/<article[\s\S]*?<\/article>/gi)].map((m) => m[0]);
    const dansArticle = zonesArticle.flatMap(lire);
    if (compterMots(dansArticle.join(" ")) >= 150) return dansArticle;
    return lire(sansScripts); // pas de balise <article> exploitable : toute la page
}

function lireDescription(html) {
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:)?description["'][^>]+content=["']([^"']*)["']/i);
    return m ? texteBrut(m[1]) : "";
}

function analyserPage(html) {
    // Balise standard (schema.org) que les sites à paywall utilisent pour le signaler aux moteurs de recherche.
    const paywallDeclare = /"isAccessibleForFree"\s*:\s*"?false"?/i.test(html);

    const texte = extraireParagraphes(html).join("\n");
    const finDuTexte = texte.slice(-1500) + " " + lireDescription(html);
    const paywallVisible = SIGNES_PAYWALL.some((re) => re.test(finDuTexte));

    return { gratuit: !paywallDeclare && !paywallVisible, mots: compterMots(texte), texte };
}

async function verifierArticle(article) {
    try {
        const { texte: html, url } = await telecharger(article.lien);
        const page = analyserPage(html);

        if (!page.gratuit) return { ...article, refus: "payant" };
        if (page.mots < MOTS_MIN) return { ...article, refus: "trop court" };

        return { ...article, lien: url, texte: page.texte, minutes: Math.round(page.mots / MOTS_PAR_MINUTE) };
    } catch {
        return { ...article, refus: "inaccessible" };
    }
}

// Affiche, pour chaque média, combien d'articles ont été retenus ou écartés.
function afficherBilan(resultats) {
    const bilan = {};
    for (const r of resultats) {
        const b = (bilan[r.source] ||= { retenu: 0, payant: 0, "trop court": 0, inaccessible: 0 });
        b[r.refus || "retenu"]++;
    }
    for (const [source, b] of Object.entries(bilan)) {
        console.log(
            `   ${b.retenu ? "✅" : "➖"} ${source} : ${b.retenu} retenu(s) · ${b.payant} payant(s) · ` +
                `${b["trop court"]} trop court(s) · ${b.inaccessible} inaccessible(s)`
        );
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

    afficherBilan(resultats);
    return resultats.filter((r) => !r.refus);
}

module.exports = { verifierArticles, MOTS_MIN };
