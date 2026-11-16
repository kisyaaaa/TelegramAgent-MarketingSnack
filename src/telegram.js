// Mise en forme et envoi du message Telegram.

const LIMITE_TELEGRAM = 4096;
const MARGE = 96;

// Telegram (parse_mode HTML) refuse le message si "<", ">" ou "&" ne sont pas échappés.
function echapper(texte) {
    return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formaterEntete(date) {
    const jour = date.toLocaleDateString("fr-CH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Zurich",
    });
    return `🍪 <b>TON MARKETING SNACK DU JOUR</b>\n📅 ${echapper(jour.charAt(0).toUpperCase() + jour.slice(1))}`;
}

// Une actualité : emoji du thème + titre en gras, résumé, médias et lien vers l'article.
function formaterSujet(sujet, themes, emojiAutre) {
    const emoji = themes.find((t) => t.nom === sujet.theme)?.emoji || emojiAutre;
    const medias = [...new Set(sujet.articles.map((a) => a.source))].join(", ");
    const etoile = sujet.majeur ? " 🔥" : "";

    return [
        `${emoji} <b>${echapper(sujet.titre)}</b>${etoile}`,
        echapper(sujet.resume),
        `🗞️ <i>${echapper(medias)}</i> · ⏱️ ${sujet.minutes} min · <a href="${echapper(sujet.lien)}">Lire l'article</a>`,
    ].join("\n");
}

// Assemble les blocs en un ou plusieurs messages de moins de 4096 caractères.
function decouper(blocs) {
    const messages = [];
    let courant = "";
    for (const bloc of blocs) {
        const suivant = courant ? `${courant}\n\n${bloc}` : bloc;
        if (suivant.length > LIMITE_TELEGRAM - MARGE && courant) {
            messages.push(courant);
            courant = bloc;
        } else {
            courant = suivant;
        }
    }
    if (courant) messages.push(courant);
    return messages;
}

async function envoyerMessage(texte) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: texte,
            parse_mode: "HTML",
            disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        throw new Error(`Telegram HTTP ${res.status} : ${data.description || "erreur inconnue"}`);
    }
}

async function envoyer(messages) {
    for (const message of messages) await envoyerMessage(message);
}

module.exports = { formaterEntete, formaterSujet, decouper, envoyer };
