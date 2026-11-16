// BabyJournalist : revue de presse marketing quotidienne envoyée sur Telegram.
//
// Utilisation :
//   node index.js          → génère et envoie la revue de presse
//   node index.js --test   → génère la revue de presse et l'affiche sans l'envoyer

const { SOURCES, THEMES, EMOJI_AUTRE, NB_ACTUS_MIN, NB_ACTUS_MAX } = require("./src/sources");
const { recupererArticles, enrichirArticle } = require("./src/flux");
const { selectionnerSujets, resumerSujet } = require("./src/ia");
const { formaterEntete, formaterSujet, decouper, envoyer } = require("./src/telegram");
const { doitEnvoyer } = require("./src/horaire");

const MODE_TEST = process.argv.includes("--test");
const AVEC_IA = Boolean(process.env.GROQ_API_KEY);

function verifierConfiguration() {
    const requises = MODE_TEST ? [] : ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "GROQ_API_KEY"];
    const manquantes = requises.filter((nom) => !process.env[nom]);
    if (manquantes.length > 0) {
        throw new Error(`Variables d'environnement manquantes : ${manquantes.join(", ")}`);
    }
}

// Mode test sans clé Groq uniquement : un article récent par média, textes bruts non traduits.
// Ne sert qu'à vérifier la lecture des médias et la mise en forme, jamais pour un envoi réel.
function selectionSansIA(articles) {
    const medias = new Set();
    return articles
        .filter((a) => !medias.has(a.source) && medias.add(a.source))
        .slice(0, NB_ACTUS_MAX)
        .map((a) => ({ articles: [a], theme: null, majeur: false }));
}

// Lien affiché : on préfère le lien direct vers le site du média à un lien Google News.
function choisirLien(articles) {
    return (articles.find((a) => !a.lien.includes("news.google.com")) || articles[0]).lien;
}

async function rediger(sujet) {
    sujet.articles = await Promise.all(sujet.articles.map(enrichirArticle));
    sujet.lien = choisirLien(sujet.articles);

    if (!AVEC_IA) {
        const a = sujet.articles[0];
        return { ...sujet, titre: a.titre, resume: a.description || "(pas d'extrait)" };
    }
    try {
        const texte = await resumerSujet(sujet);
        if (!texte) {
            console.warn(`   ⏭️ Écarté (informations insuffisantes) : ${sujet.articles[0].titre}`);
            return null;
        }
        return { ...sujet, ...texte };
    } catch (err) {
        console.warn(`   ⚠️ Résumé impossible, sujet écarté (${err.message}) : ${sujet.articles[0].titre}`);
        return null;
    }
}

function trierSujets(sujets) {
    const rang = (theme) => (theme ? THEMES.findIndex((t) => t.nom === theme) : THEMES.length);
    return [...sujets].sort((a, b) => b.majeur - a.majeur || rang(a.theme) - rang(b.theme));
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
        let selection;
        if (AVEC_IA) {
            console.log("🧠 Sélection des sujets par l'IA...");
            // Pas de solution de secours : sans IA, pas de résumés en français, donc pas d'envoi.
            selection = await selectionnerSujets(articles, THEMES, NB_ACTUS_MIN, NB_ACTUS_MAX);
            if (selection.length === 0) throw new Error("L'IA n'a retenu aucun sujet.");
        } else {
            console.warn("⚠️ GROQ_API_KEY absente : sélection sans IA (mode test uniquement).");
            selection = selectionSansIA(articles);
        }

        console.log(`✍️ Rédaction de ${selection.length} résumé(s)...`);
        const sujets = [];
        for (const s of selection) {
            const sujet = await rediger(s);
            if (sujet) sujets.push(sujet);
        }
        if (sujets.length === 0) throw new Error("Aucun résumé n'a pu être rédigé.");

        for (const sujet of trierSujets(sujets)) blocs.push(formaterSujet(sujet, THEMES, EMOJI_AUTRE));
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
