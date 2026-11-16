// Sélection des actualités et rédaction des résumés avec l'API Groq.

const GROQ_API = "https://api.groq.com/openai/v1";
// Modèles par ordre de préférence : Groq retire parfois des modèles, on prend le premier disponible.
const MODELES_PREFERES = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "llama-3.1-8b-instant",
];
const MAX_CANDIDATS = 150; // limite la taille de la requête (quota de tokens Groq)
const TENTATIVES = 3;

const CONSIGNE_SYSTEME =
    "Tu es un journaliste spécialisé en marketing et communication. Tu écris TOUJOURS en français, " +
    "même quand les articles fournis sont en anglais : tu traduis tout.";

let modeleChoisi = null;

function entetes() {
    return { Authorization: `Bearer ${(process.env.GROQ_API_KEY || "").trim()}`, "Content-Type": "application/json" };
}

async function choisirModele() {
    if (modeleChoisi) return modeleChoisi;
    const res = await fetch(`${GROQ_API}/models`, { headers: entetes(), signal: AbortSignal.timeout(30000) });
    if (res.status === 401) throw new Error("Groq refuse la clé GROQ_API_KEY (HTTP 401) : elle est invalide, expirée ou supprimée. Crée une nouvelle clé sur https://console.groq.com/keys et remplace le secret GitHub.");
    if (!res.ok) throw new Error(`liste des modèles Groq indisponible (HTTP ${res.status})`);
    const disponibles = new Set(((await res.json()).data || []).map((m) => m.id));
    modeleChoisi = MODELES_PREFERES.find((m) => disponibles.has(m));
    if (!modeleChoisi) throw new Error(`aucun modèle connu disponible chez Groq (${[...disponibles].join(", ")})`);
    console.log(`   🧠 Modèle IA : ${modeleChoisi}`);
    return modeleChoisi;
}

// Envoie une consigne à Groq et renvoie sa réponse JSON.
async function appelerGroq(consigne) {
    const model = await choisirModele();
    for (let essai = 1; ; essai++) {
        const res = await fetch(`${GROQ_API}/chat/completions`, {
            method: "POST",
            headers: entetes(),
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: CONSIGNE_SYSTEME },
                    { role: "user", content: consigne },
                ],
                temperature: 0.2,
                response_format: { type: "json_object" },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (res.ok) {
            const contenu = (await res.json()).choices?.[0]?.message?.content;
            if (!contenu) throw new Error("réponse Groq vide");
            return JSON.parse(contenu);
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
        .map((a) => `[${a.id}] (${a.source}) ${a.titre} — ${(a.description || a.texte || "").slice(0, 160)}`)
        .join("\n");
    const nomsThemes = themes.map((t) => t.nom);

    const consigne = `Tu es rédacteur en chef d'une revue de presse quotidienne destinée à des professionnels du marketing et de la communication.

Voici les articles publiés récemment par des médias spécialisés (format : [id] (média) titre — extrait) :

${liste}

Ta mission :
1. Choisis entre ${nbMin} et ${nbMax} SUJETS, les plus importants et utiles pour un professionnel du marketing.
2. Donne la priorité à ces thèmes : RP (relations presse, communication de crise, relations publiques), Data (données, mesure, tracking, cookies, adtech), IA dans le marketing, SEO (référencement, moteurs de recherche, recherche par IA). Un sujet de marketing ou de publicité vraiment important hors de ces thèmes peut être retenu avec le thème "Autre".
3. Écarte : les nominations de personnes, les palmarès et cérémonies de prix, les podcasts, les vidéos sans explication, les contenus sponsorisés, les sujets sans lien avec le marketing (politique, sport, faits divers...).
4. Si plusieurs articles (même de médias différents) parlent de la MÊME actualité, regroupe tous leurs ids dans un seul sujet.
5. "majeur" = true uniquement si l'actualité est reprise par au moins 2 médias différents ET qu'elle est vraiment importante pour le secteur.
6. Varie les médias autant que possible.

Réponds uniquement en JSON, au format :
{"sujets": [{"ids": [12, 40], "theme": "${nomsThemes[0]}", "majeur": false}]}

Valeurs possibles pour "theme" : ${[...nomsThemes, "Autre"].map((n) => `"${n}"`).join(", ")}.`;

    const reponse = await appelerGroq(consigne);
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
            theme: nomsThemes.includes(s.theme) ? s.theme : null,
            majeur: s.majeur === true && nbMedias >= 2,
        });
        if (sujets.length >= nbMax) break;
    }
    return sujets;
}

// Rédige le titre et le résumé en français d'un sujet (2 phrases, 4 pour un sujet majeur).
// Renvoie null si les informations disponibles sont insuffisantes.
async function resumerSujet(sujet) {
    const nbPhrases = sujet.majeur ? 4 : 2;
    // Texte complet de l'article (tronqué pour rester dans le quota de tokens Groq).
    const parArticle = Math.floor(6000 / sujet.articles.length);
    const sourcesTexte = sujet.articles
        .map((a) => `Média : ${a.source}\nTitre : ${a.titre}\nArticle : ${(a.texte || a.description || "").slice(0, parArticle)}`)
        .join("\n\n");

    const consigne = `Voici une actualité publiée par un ou plusieurs médias :

${sourcesTexte}

Rédige EN FRANÇAIS :
- "titre" : un titre court et informatif (12 mots maximum, sans emoji, sans nom de média).
- "resume" : un résumé de ${nbPhrases} phrases maximum, clair et précis (noms des marques, entreprises et personnes, chiffres clés). Pas de titre, pas de lien, pas d'astérisque, pas de mention du média.

N'invente rien : appuie-toi uniquement sur les informations ci-dessus.
Si elles sont trop pauvres pour comprendre de quoi parle l'actualité, réponds {"insuffisant": true}.

Réponds uniquement en JSON : {"titre": "...", "resume": "..."}`;

    const r = await appelerGroq(consigne);
    if (r.insuffisant || !r.titre || !r.resume) return null;
    const propre = (t) => String(t).replace(/\*/g, "").replace(/\s+/g, " ").trim();
    return { titre: propre(r.titre).replace(/\.$/, ""), resume: propre(r.resume) };
}

module.exports = { selectionnerSujets, resumerSujet };
