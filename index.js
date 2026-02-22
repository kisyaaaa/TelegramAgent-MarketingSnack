const fetch = require('node-fetch');

// --- LES CLÉS SONT MAINTENANT CACHÉES ET SÉCURISÉES ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;    
const GROQ_API_KEY = process.env.GROQ_API_KEY; 

async function lancerAgent() {
    console.log("🚀 L'agent Cloud se réveille...");

    try {
        const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateDuJour = new Date().toLocaleDateString('fr-FR', optionsDate);
        const dateCourte = new Date().toLocaleDateString('fr-FR'); 

        let messageFinal = `📅 <b>ACTUALITÉS DU ${dateDuJour.toUpperCase()}</b>\n\n`;

        const categories = [
            { theme: "Politique", motCle: "politique", emoji: "🏛️" },
            { theme: "Économie", motCle: "économie", emoji: "💰" },
            { theme: "Culture", motCle: "culture", emoji: "🎭" },
            { theme: "Suisse", motCle: "suisse", emoji: "🇨🇭" },
            { theme: "Ukraine", motCle: "ukraine", emoji: "🇺🇦" }
        ];

        for (let cat of categories) {
            console.log(`🔎 Traitement de : ${cat.theme}...`);
            
            const urlRecherche = `https://news.google.com/rss/search?q=site:rts.ch+${encodeURIComponent(cat.motCle)}+when:1d&hl=fr-CH&gl=CH&ceid=CH:fr`;
            const res = await fetch(urlRecherche);
            const textXml = await res.text();
            const items = textXml.split('<item>');
            
            if (items.length > 1) {
                const item = items[1]; 
                const title = (item.match(/<title>(.*?)<\/title>/)?.[1] || '').replace('<![CDATA[', '').replace(']]>', '').replace(/ - RTS.*/, ''); 
                const description = (item.match(/<description>(.*?)<\/description>/)?.[1] || '').replace(/<[^>]+>/g, '').replace('<![CDATA[', '').replace(']]>', ''); 
                const link = (item.match(/<link>(.*?)<\/link>/)?.[1] || '').replace('<![CDATA[', '').replace(']]>', '');

                const consigneIA = `Aujourd'hui, nous sommes le ${dateCourte}. Fais un résumé TRÈS CONCIS (2 phrases maximum) de cette actualité en étant précis sur les noms. Ne mets aucun titre, aucun lien, aucune étoile. Juste le texte.\n\nTitre: ${title}\nDétail: ${description}`;

                const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "user", content: consigneIA }],
                        temperature: 0.2
                    })
                });
                
                const groqData = await groqResponse.json();
                
                let resume = "Résumé indisponible.";
                if (groqData.choices && groqData.choices[0]) {
                    resume = groqData.choices[0].message.content.replace(/\*/g, '');
                }

                messageFinal += `<b>${cat.emoji} ${cat.theme.toUpperCase()}</b>\n`;
                messageFinal += `${resume}\n`;
                messageFinal += `👉 <a href="${link}">Lire l'article</a>\n\n`;

            } else {
                messageFinal += `<b>${cat.emoji} ${cat.theme.toUpperCase()}</b>\n`;
                messageFinal += `Aucune actualité majeure aujourd'hui.\n\n`;
            }
        }
        
        console.log("✅ Résumés générés. Envoi à Telegram...");

        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: messageFinal,
                parse_mode: "HTML",
                disable_web_page_preview: true
            })
        });

        console.log("🚀 MISSION ACCOMPLIE ! L'agent se rendort.");

    } catch (error) {
        console.error("❌ Erreur :", error);
    }
}

// On lance la fonction une seule fois !
lancerAgent();