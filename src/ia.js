// Sélection des actualités et rédaction des résumés avec l'API Groq.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELE = "llama-3.3-70b-versatile";
const MAX_CANDIDATS = 150; // limite la taille de la requête (quota de tokens Groq)
const TENTATIVES = 3;

async function appelerGroq(messages, { json = false, temperature = 0.2 } = {}) {
    for (let essai = 1; ; essai++) {
        const res = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODELE,
                messages,
                temperature,
                ...(json && { response_format: { type: "json_object" } }),
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (res.ok) {
            const data = await res.json();
            const contenu = data.choices?.[0]?.message?.content;
            if (!contenu) throw new Error("Réponse Groq vide");
            return contenu;
        }

        // Quota dépassé ou erreur serveur : on attend puis on réessaie.
        if ((res.status === 429 || res.status >= 500) && essai < TENTATIVES) {
            const attente = Math.min(Number(res.headers.get("retry-after")) || 20, 60);
            console.warn(`   ⏳ Groq HTTP ${res.status}, nouvel essai dans ${attente} s...`);
            await new Promise((r) => setTimeout(r, attente * 1000));
            continue;
        }
        throw new Error(`Groq HTTP ${res.status} : ${(await res.text()).slice(0, 300)}`);
    }
}

// Demande à l'IA de choisir les actualités les plus pertinentes et de regrouper
// les articles qui parlent du même sujet dans plusieurs médias.
async function selectionnerSujets(articles, themes, nbMin, nbMax) {
    const candidats = articles.slice(0, MAX_CANDIDATS);
    const liste = candidats
        .map((a) => `[${a.id}] (${a.source}) ${a.titre}${a.description ? ` — ${a.description.slice(0, 120)}` : ""}`)
        .join("\n");
    const nomsThemes = themes.map((t) => t.nom);

    const consigne = `Tu es rédacteur en chef d'une revue de presse quotidienne destinée à des professionnels du marketing et de la communication.

Voici les articles publiés récemment par des médias spécialisés (format : [id] (média) titre — extrait) :

${liste}

Ta mission :
1. Choisis entre ${nbMin} et ${nbMax} SUJETS, les plus importants et utiles pour un professionnel du marketing.
2. Donne la priorité à ces thèmes : RP (relations presse, communication de crise, relations publiques), Data (données, mesure, tracking, cookies, adtech), IA dans le marketing, SEO (référencement, moteurs de recherche, recherche par IA). Un sujet de marketing ou de publicité très important hors de ces thèmes peut être retenu avec le thème "Marketing".
3. Écarte : les nominations de personnes, les palmarès et cérémonies de prix, les podcasts, les contenus sponsorisés, les sujets sans lien avec le marketing.
4. Si plusieurs articles (même de médias différents) parlent de la MÊME actualité, regroupe tous leurs ids dans un seul sujet.
5. "majeur" = true uniquement si l'actualité est reprise par au moins 2 médias différents ET qu'elle est vraiment importante pour le secteur.
6. Varie les médias autant que possible.

Réponds uniquement en JSON, au format :
{"sujets": [{"ids": [12, 40], "theme": "IA & marketing", "majeur": false}]}

Valeurs possibles pour "theme" : ${nomsThemes.map((n) => `"${n}"`).join(", ")}.`;

    const reponse = JSON.parse(await appelerGroq([{ role: "user", content: consigne }], { json: true }));
    const parId = new Map(candidats.map((a) => [a.id, a]));
    const dejaPris = new Set();
    const sujets = [];

    for (const s of reponse.sujets || []) {
        const groupe = (s.ids || []).map(Number).filter((id) => parId.has(id) && !dejaPris.has(id));
        if (groupe.length === 0) continue;
        groupe.forEach((id) => dejaPris.add(id));
        const arts = groupe.map((id) => parId.get(id));
        const nbMedias = new Set(arts.map((a) => a.source)).size;
        sujets.push({
            articles: arts,
            theme: nomsThemes.includes(s.theme) ? s.theme : "Marketing",
            majeur: s.majeur === true && nbMedias >= 2,
        });
        if (sujets.length >= nbMax) break;
    }
    return sujets;
}

// Rédige le résumé en français d'un sujet (2 phrases, 4 pour un sujet majeur).
async function resumerSujet(sujet) {
    const nbPhrases = sujet.majeur ? 4 : 2;
    const sourcesTexte = sujet.articles
        .map((a) => `Média : ${a.source}\nTitre : ${a.titre}${a.description ? `\nExtrait : ${a.description}` : ""}`)
        .join("\n\n");

    const consigne = `Résume cette actualité en FRANÇAIS, en ${nbPhrases} phrases maximum, de façon claire et précise (noms des marques, entreprises et personnes, chiffres clés).
Les articles peuvent être en anglais ou en allemand : traduis.
N'écris aucun titre, aucun lien, aucun astérisque, aucune mention du média. Juste le texte du résumé.
N'invente rien : appuie-toi uniquement sur les informations ci-dessous.

${sourcesTexte}`;

    const texte = await appelerGroq([{ role: "user", content: consigne }]);
    return texte.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

module.exports = { selectionnerSujets, resumerSujet };
