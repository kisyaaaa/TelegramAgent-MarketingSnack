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
    return `📰 <b>REVUE DE PRESSE MARKETING</b>\n📅 ${echapper(jour.charAt(0).toUpperCase() + jour.slice(1))}`;
}

function formaterSujet(sujet, themes) {
    const theme = themes.find((t) => t.nom === sujet.theme) || { nom: sujet.theme, emoji: "🎯" };
    const medias = [...new Set(sujet.articles.map((a) => a.source))].join(", ");
    const lien = sujet.articles[0].lien;
    const etoile = sujet.majeur ? " 🔥" : "";

    return [
        `<b>${theme.emoji} ${echapper(theme.nom.toUpperCase())}</b>${etoile}`,
        echapper(sujet.resume),
        `🗞️ <i>${echapper(medias)}</i> · <a href="${echapper(lien)}">Lire l'article</a>`,
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

module.exports = { echapper, formaterEntete, formaterSujet, decouper, envoyer };
