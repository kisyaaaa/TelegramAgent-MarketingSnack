# 📰 BabyJournalist

**Ta revue de presse marketing, résumée en français et livrée chaque matin sur Telegram.**

BabyJournalist est un agent automatique qui lit chaque jour 20 médias spécialisés en marketing et communication, sélectionne les 7 à 8 actualités les plus importantes et les résume en français. Il envoie le tout sur Telegram à 8 h, heure suisse.

---

## ✨ Fonctionnalités

- **20 médias de référence uniquement** : aucune actualité ne provient d'un autre site.
- **Contenu ciblé** sur quatre thèmes : 📣 RP, 📊 Data, 🤖 IA dans le marketing et 🔎 SEO. Un sujet marketing majeur hors de ces thèmes peut aussi être retenu (🎯 Marketing).
- **Sélection par IA** : les nominations, les cérémonies de prix, les podcasts et les contenus sponsorisés sont écartés.
- **Regroupement des doublons** : une même actualité reprise par plusieurs médias devient un seul sujet, avec la liste des médias.
- **Résumés en français**, même pour les articles en anglais ou en allemand : 2 phrases par sujet, ou 4 pour une actualité majeure 🔥 reprise par plusieurs médias.
- **Édition du lundi** : elle couvre aussi le week-end.
- **Envoi à 8 h en Suisse**, été comme hiver, sans rien changer au changement d'heure.
- **Fiable** : le message est découpé s'il dépasse la limite de Telegram, et chaque erreur fait échouer l'action GitHub, ce qui t'avertit par e-mail.

## 📬 Aperçu du message

```
📰 REVUE DE PRESSE MARKETING
📅 Lundi, 16 novembre 2026

🤖 IA & MARKETING 🔥
Résumé de l'actualité en quatre phrases, car elle est reprise par plusieurs médias…
🗞️ Digiday, Adweek, The Drum · Lire l'article

🔎 SEO
Résumé de l'actualité en deux phrases…
🗞️ Search Engine Land · Lire l'article
```

## 🗞️ Médias suivis

| Francophones | Anglophones | Suisse (DE) |
|---|---|---|
| Stratégies | Adweek | persoenlich.com |
| CB News | Ad Age | |
| INfluencia | Campaign | |
| L'ADN | The Drum | |
| E-marketing | Marketing Week | |
| La Réclame | Digiday | |
| The Media Leader | WARC | |
| Journal du Net | Contagious | |
| Blog du Modérateur | PRWeek | |
| | Search Engine Land | |

Chaque média est lu par son **flux RSS officiel**. Quand un média n'en propose pas, ou que le flux est inaccessible, l'agent passe par **Google News, filtré sur le seul site de ce média**. Certains médias (WARC, Contagious, Ad Age…) sont en grande partie payants : seuls leurs titres publics sont exploités.

## ⚙️ Fonctionnement

```
GitHub Actions (chaque matin)
        │
        ▼
1. Lecture des flux RSS des 20 médias  ── src/flux.js
        │
        ▼
2. Sélection de 7-8 sujets par l'IA    ── src/ia.js  (Groq · Llama 3.3 70B)
        │
        ▼
3. Résumé en français de chaque sujet  ── src/ia.js
        │
        ▼
4. Mise en forme et envoi              ── src/telegram.js
```

### Structure du projet

```
.
├── index.js                  # Point d'entrée : orchestre les étapes
├── src/
│   ├── sources.js            # Médias suivis, thèmes et nombre d'actualités
│   ├── flux.js               # Lecture des flux RSS et filtre sur les dernières 24 h
│   ├── ia.js                 # Sélection des sujets et résumés (API Groq)
│   ├── telegram.js           # Mise en forme HTML et envoi Telegram
│   └── horaire.js            # Gestion de l'heure suisse (été / hiver)
├── .github/workflows/
│   └── matin.yml             # Planification quotidienne
├── .env.example              # Modèle des variables d'environnement
└── package.json
```

Le projet n'a **aucune dépendance** : il utilise uniquement Node.js (20.6 ou plus récent).

## 🚀 Installer ton propre agent

### 1. Créer le bot Telegram

1. Sur Telegram, écris à [@BotFather](https://t.me/BotFather) et envoie `/newbot`.
2. Note le **token** du bot qu'il te donne.
3. Envoie un message à ton bot, puis ouvre `https://api.telegram.org/bot<TOKEN>/getUpdates` : la valeur `chat.id` est ton **identifiant de conversation**.

### 2. Obtenir une clé Groq (gratuite)

Crée une clé API sur [console.groq.com/keys](https://console.groq.com/keys).

### 3. Configurer GitHub

1. Fais un *fork* de ce dépôt.
2. Va dans **Settings → Secrets and variables → Actions → New repository secret** et ajoute :

| Secret | Valeur |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Le token donné par BotFather |
| `TELEGRAM_CHAT_ID` | L'identifiant de ta conversation |
| `GROQ_API_KEY` | Ta clé API Groq |

3. Dans l'onglet **Actions**, active les workflows et lance **« Revue de presse marketing matinale »** avec le bouton **Run workflow** pour tester.

> 🔒 Les clés ne sont jamais écrites dans le code : elles sont lues depuis les secrets GitHub, ou depuis le fichier `.env` en local, qui est exclu du dépôt par le `.gitignore`.

## 💻 Lancer en local

```bash
# 1. Copier le modèle et remplir les valeurs
cp .env.example .env

# 2. Générer la revue de presse et l'afficher sans l'envoyer
npm run test:local

# 3. Générer et envoyer réellement sur Telegram
npm run envoi:local
```

Sans clé Groq, le mode test fonctionne quand même : il fait une sélection simple, sans IA, pour vérifier la lecture des médias et la mise en forme.

## 🛠️ Personnaliser

Tout se règle dans [`src/sources.js`](src/sources.js) :

- **Ajouter ou retirer un média** : ajoute une ligne `{ nom, rss, domaine, langue }`. Le champ `rss` est facultatif.
- **Changer les thèmes** : modifie la liste `THEMES`, et adapte la consigne dans [`src/ia.js`](src/ia.js).
- **Changer le nombre d'actualités** : `NB_ACTUS_MIN` et `NB_ACTUS_MAX`.

Pour changer l'heure d'envoi, modifie `HEURE_CIBLE_SUISSE` dans [`src/horaire.js`](src/horaire.js) **et** les deux lignes `cron` dans [`matin.yml`](.github/workflows/matin.yml).

## ℹ️ Bon à savoir

- GitHub démarre parfois les tâches planifiées avec quelques minutes de retard : le message arrive généralement entre 8 h et 8 h 15.
- Sur un dépôt public, GitHub **met en pause les tâches planifiées après 60 jours sans activité** sur le dépôt. Il suffit alors de les réactiver dans l'onglet **Actions**.
- Le quota gratuit de Groq suffit largement pour un envoi par jour.
