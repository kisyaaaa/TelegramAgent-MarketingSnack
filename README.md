# 📰 BabyJournalist

**Ta revue de presse marketing, résumée en français et livrée chaque matin sur Telegram.**

BabyJournalist est un agent automatique. Chaque jour, il lit les principaux médias francophones et anglophones spécialisés en marketing et communication, et ne garde que les **articles complets et gratuits**. Il en sélectionne les 7 à 8 plus importants, les résume en français et envoie le tout sur Telegram à 8 h, heure suisse.

---

## ✨ Fonctionnalités

- **Médias de référence uniquement** : aucune actualité ne provient d'un autre site, et chaque lien mène directement à l'article sur le site du média.
- **Articles gratuits uniquement** : chaque page est ouverte comme le ferait une personne sans abonnement. Les articles signalés payants, ou dont la suite est réservée aux abonnés, sont écartés.
- **Vrais articles, pas des brèves** : seuls les articles d'au moins **1000 mots (≈ 5 minutes de lecture)** sont retenus. Le temps de lecture est affiché dans le message.
- **Contenu ciblé** sur quatre thèmes prioritaires : 🤖 IA dans le marketing, 📊 Data, 🔎 SEO et 📣 RP. Un sujet marketing vraiment important hors de ces thèmes peut aussi être retenu (📌).
- **Sélection par IA** : les nominations, les cérémonies de prix, les podcasts et les contenus sponsorisés sont écartés.
- **Regroupement des doublons** : une même actualité reprise par plusieurs médias devient un seul sujet, avec la liste des médias.
- **Tout en français** : titre et résumé rédigés en français à partir du texte complet de l'article, même pour les articles en anglais. Chaque résumé fait 2 phrases, ou 4 pour une actualité majeure 🔥 reprise par plusieurs médias.
- **Édition du lundi** : elle couvre aussi le week-end.
- **Envoi à 8 h en Suisse**, été comme hiver, sans rien changer au changement d'heure.
- **Fiable** : le message est découpé s'il dépasse la limite de Telegram. Si l'IA est indisponible, aucun message non traduit n'est envoyé : l'action GitHub échoue et t'avertit par e-mail.

## 📬 Aperçu du message

```
📰 REVUE DE PRESSE MARKETING
📅 Lundi, 16 novembre 2026

🤖 Titre de l'actualité en français 🔥
Résumé en quatre phrases, car l'actualité est reprise par plusieurs médias…
🗞️ Digiday, L'ADN · ⏱️ 8 min · Lire l'article

🔎 Titre de l'actualité en français
Résumé en deux phrases…
🗞️ Blog du Modérateur · ⏱️ 6 min · Lire l'article
```

L'emoji indique le thème : 🤖 IA & marketing · 📊 Data · 🔎 SEO · 📣 RP · 📌 autre sujet important.

## 🗞️ Médias suivis

| Francophones | Anglophones |
|---|---|
| L'ADN | Digiday |
| E-marketing | Search Engine Journal |
| La Réclame | HubSpot Marketing Blog |
| The Media Leader | Moz Blog |
| Journal du Net | |
| Blog du Modérateur | |
| Webmarketing & co'm | |
| Abondance | |

Chaque média est lu directement sur son site, par son **flux RSS officiel**.

Ces médias ont été choisis parce qu'ils publient régulièrement des articles **gratuits et complets**. HubSpot et Moz proposent surtout des guides et des analyses de fond plutôt que de l'actualité chaude. Un média dont le site est inaccessible un jour donné est simplement ignoré ce jour-là.

**Médias écartés :** Stratégies, CB News, INfluencia, Adweek, Ad Age, Campaign, PRWeek, Marketing Week, Search Engine Land, The Drum, WARC et Contagious. Leurs articles sont presque toujours payants ou trop courts, ou leur site bloque la lecture automatique.

## ⚙️ Fonctionnement

```
GitHub Actions (chaque matin)
        │
        ▼
1. Lecture des flux RSS des médias               ── src/flux.js
        │
        ▼
2. Vérification de chaque article :              ── src/verification.js
   gratuit ? au moins 5 min de lecture ?
        │
        ▼
3. Sélection de 7-8 sujets par l'IA              ── src/ia.js  (Groq)
        │
        ▼
4. Titre et résumé en français                   ── src/ia.js
        │
        ▼
5. Mise en forme et envoi                        ── src/telegram.js
```

### Structure du projet

```
.
├── index.js                  # Point d'entrée : orchestre les étapes
├── src/
│   ├── sources.js            # Médias suivis, thèmes et nombre d'actualités
│   ├── flux.js               # Lecture des flux RSS, filtre sur les dernières 24 h
│   ├── verification.js       # Écarte les articles payants ou trop courts
│   ├── ia.js                 # Sélection des sujets et résumés (API Groq)
│   ├── telegram.js           # Mise en forme HTML et envoi Telegram
│   ├── horaire.js            # Gestion de l'heure suisse (été / hiver)
│   └── web.js                # Outils communs : téléchargement, nettoyage du HTML
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

- **Ajouter ou retirer un média** : ajoute ou supprime une ligne `{ nom, rss, domaine }`.
- **Changer les thèmes** : modifie la liste `THEMES`, et adapte la consigne dans [`src/ia.js`](src/ia.js).
- **Changer le nombre d'actualités** : `NB_ACTUS_MIN` et `NB_ACTUS_MAX`.

La longueur minimale des articles se règle avec `MOTS_MIN` dans [`src/verification.js`](src/verification.js). Elle vaut 1000 mots par défaut, soit environ 5 minutes de lecture.

Pour changer l'heure d'envoi, modifie `HEURE_CIBLE_SUISSE` dans [`src/horaire.js`](src/horaire.js) **et** les deux lignes `cron` dans [`matin.yml`](.github/workflows/matin.yml).

## ℹ️ Bon à savoir

- GitHub démarre parfois les tâches planifiées avec quelques minutes de retard : le message arrive généralement entre 8 h et 8 h 15.
- Sur un dépôt public, GitHub **met en pause les tâches planifiées après 60 jours sans activité** sur le dépôt. Il suffit alors de les réactiver dans l'onglet **Actions**.
- Le quota gratuit de Groq suffit largement pour un envoi par jour.
