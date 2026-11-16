// Outils communs pour lire les sites des médias.

// Le robot s'identifie honnêtement : plusieurs médias bloquent les faux navigateurs.
const USER_AGENT = "Mozilla/5.0 (compatible; BabyJournalist/2.0; +https://github.com/kisyaaaa/TelegramAgent-BabyJournalist)";
const TIMEOUT_MS = 20000;

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

// Télécharge une page ou un flux. Renvoie le texte et l'adresse finale (après redirection).
async function telecharger(url) {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { texte: await res.text(), url: res.url || url };
    } catch (err) {
        throw new Error(err.name === "TimeoutError" ? "délai dépassé" : err.message);
    }
}

// Remplace les entités HTML (&amp;, &eacute;, &#8217;...) par les caractères correspondants.
function decoderEntites(texte) {
    return texte
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code) => {
            if (code[0] === "#") {
                const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
                return Number.isFinite(n) ? String.fromCodePoint(n) : tout;
            }
            return ENTITES[code.toLowerCase()] ?? tout;
        })
        .replace(/ /g, " ");
}

// Transforme un fragment HTML en texte brut sur une ligne.
function texteBrut(html) {
    return decoderEntites(decoderEntites(html).replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

module.exports = { telecharger, decoderEntites, texteBrut };
