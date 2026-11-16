// BabyJournalist : revue de presse marketing quotidienne envoyée sur Telegram.
//
// Utilisation :
//   node index.js          → génère et envoie la revue de presse
//   node index.js --test   → génère la revue de presse et l'affiche sans l'envoyer

const { SOURCES, THEMES, NB_ACTUS_MIN, NB_ACTUS_MAX } = require("./src/sources");
const { recupererArticles } = require("./src/flux");
const { selectionnerSujets, resumerSujet } = require("./src/ia");
const { formaterEntete, formaterSujet, decouper, envoyer } = require("./src/telegram");
const { doitEnvoyer } = require("./src/horaire");

const MODE_TEST = process.argv.includes("--test");

function verifierConfiguration() {
    const requises = MODE_TEST ? [] : ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "GROQ_API_KEY"];
    const manquantes = requises.filter((nom) => !process.env[nom]);
    if (manquantes.length > 0) {
        throw new Error(`Variables d'environnement manquantes : ${manquantes.join(", ")}`);
    }
}

// Sélection de secours si l'IA est indisponible : les articles les plus récents, un par média.
function selectionSimple(articles) {
    const medias = new Set();
    return articles
        .filter((a) => !medias.has(a.source) && medias.add(a.source))
        .slice(0, NB_ACTUS_MAX)
        .map((a) => ({ articles: [a], theme: "Marketing", majeur: false }));
}

async function choisirSujets(articles) {
    if (!process.env.GROQ_API_KEY) {
        console.warn("⚠️ GROQ_API_KEY absente : sélection simple sans IA (mode test).");
        return selectionSimple(articles);
    }
    try {
        const sujets = await selectionnerSujets(articles, THEMES, NB_ACTUS_MIN, NB_ACTUS_MAX);
        if (sujets.length > 0) return sujets;
        console.warn("⚠️ L'IA n'a retenu aucun sujet : sélection simple.");
    } catch (err) {
        console.warn(`⚠️ Sélection IA impossible (${err.message}) : sélection simple.`);
    }
    return selectionSimple(articles);
}

async function rediger(sujet) {
    if (process.env.GROQ_API_KEY) {
        try {
            return await resumerSujet(sujet);
        } catch (err) {
            console.warn(`⚠️ Résumé impossible (${err.message}).`);
        }
    }
    const a = sujet.articles[0];
    return a.description ? a.description.slice(0, 280) : a.titre;
}

function trierSujets(sujets) {
    const ordre = THEMES.map((t) => t.nom);
    return [...sujets].sort((a, b) => b.majeur - a.majeur || ordre.indexOf(a.theme) - ordre.indexOf(b.theme));
}

async function lancerAgent() {
    if (!doitEnvoyer(process.env.PLANIFICATION)) {
        console.log("⏰ Ce n'est pas 8 h en Suisse pour cette planification : rien à faire.");
        return;
    }
    verifierConfiguration();
    console.log("🚀 L'agent se réveille...");

    console.log("🔎 Lecture des médias...");
    const articles = await recupererArticles(SOURCES);
    console.log(`📚 ${articles.length} article(s) récent(s) trouvé(s).`);

    const blocs = [formaterEntete(new Date())];

    if (articles.length === 0) {
        blocs.push("Aucune actualité publiée par les médias suivis depuis hier.");
    } else {
        console.log("🧠 Sélection des sujets...");
        const sujets = trierSujets(await choisirSujets(articles));

        console.log(`✍️ Rédaction de ${sujets.length} résumé(s)...`);
        for (const sujet of sujets) {
            sujet.resume = await rediger(sujet);
            blocs.push(formaterSujet(sujet, THEMES));
        }
    }

    const messages = decouper(blocs);

    if (MODE_TEST) {
        console.log("\n🧪 MODE TEST : message non envoyé.\n");
        messages.forEach((m, i) => console.log(`----- Message ${i + 1}/${messages.length} (${m.length} caractères) -----\n${m}\n`));
        return;
    }

    console.log(`📨 Envoi de ${messages.length} message(s) sur Telegram...`);
    await envoyer(messages);
    console.log("✅ Revue de presse envoyée ! L'agent se rendort.");
}

lancerAgent().catch((err) => {
    console.error("❌ Erreur :", err.message);
    process.exitCode = 1; // fait échouer la GitHub Action pour être averti par e-mail
});
