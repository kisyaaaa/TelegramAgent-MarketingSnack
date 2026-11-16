// Envoi à 8 h, heure suisse, été comme hiver.
//
// GitHub Actions ne connaît que l'heure UTC. Le workflow déclenche donc deux
// planifications (l'une calée sur l'heure d'hiver, l'autre sur l'heure d'été)
// et ce module ne laisse passer que celle qui correspond à l'heure suisse du jour.
// On se base sur l'heure PRÉVUE (github.event.schedule) et non sur l'heure réelle,
// car GitHub démarre parfois les tâches planifiées avec plusieurs minutes de retard.

const HEURE_CIBLE_SUISSE = 7; // planification à 7 h 55 → message reçu vers 8 h

function decalageSuisse(date = new Date()) {
    const heureSuisse = Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", hourCycle: "h23" }).format(date)
    );
    return (heureSuisse - date.getUTCHours() + 24) % 24; // 1 en hiver, 2 en été
}

// planification : texte cron reçu de GitHub, ex. "55 5 * * *". Vide = lancement manuel.
function doitEnvoyer(planification, date = new Date()) {
    if (!planification) return true;
    const heureUtc = Number(planification.trim().split(/\s+/)[1]);
    return (heureUtc + decalageSuisse(date)) % 24 === HEURE_CIBLE_SUISSE;
}

module.exports = { doitEnvoyer, decalageSuisse };
