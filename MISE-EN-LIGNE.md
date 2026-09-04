# Mettre ibsignature.com en ligne

Vous avez déjà déployé Staytle sur Railway et conciergerie.ibsignature.com
depuis GitHub. Ce document ne réexplique donc pas ces outils : il dit ce qui
est propre à ce site-ci, et surtout les trois endroits où l'on se trompe.

Comptez une heure, dont quarante minutes d'attente de DNS.

---

## Les trois pièges, avant tout le reste

**Le volume.** Sans volume monté sur `DATA_DIR`, votre base est effacée à
chaque déploiement — vingt-quatre logements équipés, seize calendriers, votre
RIB, vos conditions, vos demandes de virement. Tout. Et cela ne se voit
qu'après, quand vous ouvrez l'administration et qu'elle est vide. C'est
l'étape 3, et c'est celle qu'il ne faut pas remettre à plus tard.

**La base.** Vous avez déjà saisi beaucoup. Elle se transporte (étape 6), elle
ne se ressaisit pas.

**Le courrier.** Sans domaine vérifié chez Resend, aucun courriel ne part vers
un vrai voyageur. C'est l'étape la plus longue en délai d'attente : commencez-la
en premier, elle mûrira pendant que vous faites le reste.

---

## 1. Le domaine chez Resend — à lancer en premier

Sur resend.com → **Domains** → **Add Domain** → `ibsignature.com`.

Resend affiche trois enregistrements DNS à poser chez votre registrar : un TXT
(SPF), un TXT (DKIM) et un MX pour les retours. Posez-les, puis revenez plus
tard cliquer sur **Verify** — la propagation prend de quelques minutes à
quelques heures.

Pendant ce temps, créez la clef : **API Keys** → **Create**. Gardez-la de côté
sans la faire transiter par un courriel ni une conversation.

> L'expéditeur d'essai `onboarding@resend.dev` n'écrit **qu'au titulaire du
> compte**. Il fonctionne, ce qui le rend trompeur : vos courriels partent, et
> aucun voyageur n'en reçoit jamais. L'administration vous le signalera tant
> que `MAIL_FROM` ne sera pas à vous.

---

## 2. Le dépôt GitHub

Un dépôt **privé** : ce code porte votre logique de prix et vos textes.

Depuis le dossier du site, sur votre machine :

```
git remote add origin https://github.com/VOTRE-COMPTE/ibsignature.git
git branch -M main
git push -u origin main
```

Rien de sensible ne part : `.gitignore` écarte déjà `.env*`, la base et les
photographies déposées. Vérifiez-le d'un coup d'œil après le premier envoi —
le dépôt ne doit contenir aucun fichier `.db`.

---

## 3. Le service Railway, et son volume

**New Project** → **Deploy from GitHub repo** → votre dépôt.

Railway détecte le `Dockerfile` et construit. Laissez-le finir : le premier
build est long, `better-sqlite3` se compile.

Puis, **avant tout autre chose** :

**Service → Variables → + New Volume**

    Mount path : /data

Et dans les variables :

    DATA_DIR = /data

C'est tout ce qui sépare une base durable d'une base effacée à chaque
déploiement.

---

## 4. Les variables

Service → **Variables** → **Raw Editor**, puis collez et complétez :

```
DATA_DIR=/data
SITE_URL=https://ibsignature.com
LODGIFY_API_KEY=
RESEND_API_KEY=
MAIL_FROM=IB Signature <reservations@ibsignature.com>
ADMIN_PASSWORD=
ADMIN_SECRET=
CRON_SECRET=
```

- `ADMIN_PASSWORD` : ce que vous taperez pour entrer dans l'administration.
- `ADMIN_SECRET` et `CRON_SECRET` : deux longues chaînes aléatoires,
  différentes l'une de l'autre. `openssl rand -hex 32` en donne une.
- `LODGIFY_API_KEY` : profitez-en pour la **régénérer** chez Lodgify. L'actuelle
  a circulé.

Ne me les envoyez pas — je n'en ai pas besoin, et une clef qui passe dans une
conversation cesse d'être une clef.

---

## 5. Le domaine du site

Service → **Settings** → **Networking** → **Custom Domain** → `ibsignature.com`.

Railway donne un enregistrement à poser chez votre registrar. Deux cas :

- **CNAME** si votre registrar l'accepte sur la racine (Cloudflare, OVH récent).
- **A** vers l'adresse IP que Railway indique, sinon.

Ajoutez aussi `www.ibsignature.com` en CNAME vers `ibsignature.com`.

`conciergerie.ibsignature.com` n'est pas touché : c'est un sous-domaine
distinct, avec ses propres enregistrements.

---

## 6. Emporter votre base

C'est l'étape qui vous épargne une soirée de ressaisie.

1. **Sur votre machine**, site lancé : Admin → Réglages → **Sauvegarde** →
   *Télécharger la base*. Vous obtenez `ibsignature-2026-09-XX.db`.

2. **En ligne**, une fois le site déployé : ouvrez
   `https://ibsignature.com/admin`, connectez-vous, puis Réglages →
   **Sauvegarde** → *Reposer une base*. Déposez le fichier, écrivez
   `REMPLACER`, validez.

3. La page réaffiche ce que contient la base. Vérifiez les chiffres : vous
   devez retrouver vos 24 logements, vos calendriers et vos réglages.

> **Ne copiez jamais le fichier `.db` à la main depuis l'explorateur.** SQLite
> écrit d'abord dans un fichier d'attente (`.db-wal`) et ne le reverse que de
> temps en temps : sur votre machine, le fichier principal fait 57 Ko et
> l'attente 1,9 Mo. Une copie manuelle vous ferait perdre plusieurs jours de
> travail sans le moindre message d'erreur. Le bouton, lui, reverse avant de
> copier.

---

## 7. Le rafraîchissement nocturne des calendriers

Voir `DEPLOIEMENT-BATCH.md`. En résumé : un second service Railway dont la
seule commande est

```
curl -fsS -X POST https://ibsignature.com/api/flux -H "x-cron-secret: $CRON_SECRET"
```

avec le même `CRON_SECRET` et le Cron Schedule `0 3 * * *` (3 h UTC = 3 h à
Casablanca depuis le 20 septembre).

---

## 8. Ce qu'il faut vérifier avant de dire que c'est en ligne

Dans cet ordre, et sans en sauter.

**L'administration**

- [ ] `https://ibsignature.com/admin` s'ouvre et le mot de passe fonctionne.
- [ ] Aucun bandeau rouge en haut : ni « les courriels ne partent pas », ni
      « l'expéditeur est encore celui d'essai », ni calendriers périmés.
- [ ] Réglages → Sauvegarde affiche bien vos 24 logements.
- [ ] Réglages → Connexion Lodgify : 24 logements, prix d'un séjour lisible,
      disponibilités lues.

**Le parcours d'un voyageur**

- [ ] Saisir des dates sur la page des logements : les prix de séjour
      s'affichent sous chaque appartement.
- [ ] Ouvrir une fiche : le même total qu'en liste, et les dates déjà remplies.
- [ ] Cliquer sur Réserver, remplir le formulaire, choisir **virement** :
      vous recevez le courriel, et le voyageur aussi.
- [ ] Recommencer en choisissant **carte** : vous devez atterrir sur
      `checkout.lodgify.com/fr/ibsignature/…/contact`, sur le bon appartement.
- [ ] Passer le site en anglais et refaire le test carte : l'adresse doit
      porter `/en/`.
- [ ] Annuler ensuite vos demandes d'essai dans Réservations, sinon elles
      tiennent les dates.

**Le référencement**

- [ ] `https://ibsignature.com/robots.txt` et `/sitemap.xml` répondent.
- [ ] Coller l'adresse du site dans WhatsApp : une photographie doit
      apparaître.
- [ ] Déclarer le site dans Google Search Console et y soumettre le plan du
      site.

---

## Ce qui restera à faire après

Rien de bloquant, mais rien d'oubliable non plus.

- **L'assiette du plan tarifaire Lodgify.** Vos frais de transaction portent
  sur l'hébergement seul, pas sur le ménage : environ 1,16 € manquants par
  réservation.
- **Les trois crochets des CGV** : caution, délai de signalement des
  dégradations, assurance.
- **Faire relire les CGV** par un juriste, en même temps que le contrat de
  distribution Staytle.
- **Une sauvegarde par mois**, depuis Réglages → Sauvegarde. Le volume Railway
  n'a aucune redondance.
