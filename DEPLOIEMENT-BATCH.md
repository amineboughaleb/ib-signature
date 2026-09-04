# Le rafraîchissement nocturne des calendriers

## Où en est-on

Ce document décrit une chose à faire **une fois le site en ligne**. Tant que
le site ne tourne que sur votre machine, il n'y a rien à régler : aucun
ordonnanceur ne peut appeler `localhost`. Gardez cette page pour le jour du
déploiement.

En attendant, les calendriers se relisent de deux façons : le bouton dans
Admin → Calendriers, et la relecture de secours que la page des logements
déclenche d'elle-même quand elle constate qu'ils ont vieilli.

## Ce que c'est

Une adresse que votre hébergeur appelle chaque nuit, et qui relit les
vingt-quatre exports iCal de Lodgify. Rien de plus que ce que fait le bouton
« Relire tous les calendriers ».

    POST  https://ibsignature.com/api/flux
    En-tête :  x-cron-secret: <votre secret>

## L'heure : `0 3 * * *`

Les tâches planifiées se règlent toujours en UTC, jamais en heure locale.

**Le Maroc revient à l'heure GMT le 20 septembre 2026 à 2 h du matin**, par
décret adopté en Conseil de gouvernement le 25 juin 2026. Il met fin au GMT+1
permanent instauré en 2018. À partir de cette date, l'heure de Casablanca est
exactement l'heure UTC : **3 h UTC = 3 h à Casablanca**, toute l'année, sans
exception ni Ramadan.

    0 3 * * *

Si vous déployez avant le 20 septembre, la tâche partira à 4 h locales pendant
ces quelques jours, puis se recalera seule. Ce n'est pas une raison pour régler
`0 2` en attendant : vous auriez à y revenir, et une tâche qu'on oublie de
recorriger est pire qu'une heure décalée en pleine nuit.

## Les deux réglages sur Railway

Railway appelle « service » le conteneur qui fait tourner votre site.
Ouvrez-le, et faites deux choses.

### 1. La variable secrète

Onglet **Variables** → bouton **New Variable**.

    Nom    : CRON_SECRET
    Valeur : une longue chaîne aléatoire

Générez-la où vous voulez — un gestionnaire de mots de passe, ou dans un
terminal :

    openssl rand -hex 32

Ne la faites transiter par aucune conversation ni aucun courriel. Elle ne
protège rien de confidentiel : elle empêche seulement un inconnu de déclencher
vingt-quatre téléchargements à volonté.

### 2. L'horaire

Onglet **Settings** du service → section **Cron Schedule** → `0 3 * * *`.

Attention : sur Railway, un service avec un « Cron Schedule » est *démarré* à
l'heure dite, puis s'arrête. Ce n'est pas ce qu'on veut pour un site web, qui
doit tourner en permanence. Deux façons de s'en sortir :

**Soit** un second service, dans le même projet, dont la seule tâche est
d'appeler l'adresse. Son démarrage :

    curl -fsS -X POST https://ibsignature.com/api/flux -H "x-cron-secret: $CRON_SECRET"

Donnez-lui la même variable `CRON_SECRET`, et le Cron Schedule `0 3 * * *`.

**Soit** un ordonnanceur extérieur — n'importe lequel fait l'affaire, il doit
seulement pouvoir envoyer un **en-tête**. Le secret ne doit jamais passer dans
l'adresse : une clef écrite dans une URL se retrouve dans les journaux de tous
les serveurs traversés.

## Ce que la tâche répond

    {
      "ok": true,
      "duree_ms": 8412,
      "flux": 24,
      "relus": 24,
      "echecs": 0,
      "fraicheur": { "total": 24, "perimes": 0, "jamaisLus": 0, "pireAgeH": 0.01 }
    }

`ok` est faux dès qu'un seul calendrier a résisté, et `details` dit lequel. Un
ordonnanceur qui affiche « 200 » sur un import où vingt calendriers ont échoué
ne sert à rien.

## Vérifier que ça marche, sans attendre 3 h du matin

Depuis votre poste, une fois le site en ligne :

    curl -X POST https://ibsignature.com/api/flux -H "x-cron-secret: VOTRE_SECRET"

Et sans le secret, pour vérifier que la porte est bien fermée :

    curl -i -X POST https://ibsignature.com/api/flux

Vous devez lire `401`. Si vous lisez `503`, c'est que `CRON_SECRET` n'est pas
renseignée sur le service.

## Si la tâche ne tourne pas

Trois filets, dans cet ordre.

**Le site cesse de se fier aux calendriers périmés.** Au-delà de 36 heures, la
garde du virement ne répond plus « rien à signaler » mais « je ne sais pas » —
et le virement n'est plus proposé sur ces logements, plutôt que d'être proposé
sur une semaine peut-être déjà vendue. C'est le filet qui compte : il rend
l'oubli coûteux en réservations, jamais en remboursements.

**La page des logements relance l'import d'elle-même** quand elle constate que
les calendriers ont vieilli. Une relecture à la fois, une par heure au plus.
Le visiteur n'attend pas : il voit ce qu'on avait, et la relecture se fait
derrière.

**Admin → Calendriers le dit en tête de page**, avec le nombre de calendriers
concernés.
