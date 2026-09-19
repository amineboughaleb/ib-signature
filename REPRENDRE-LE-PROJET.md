# Reprendre le projet

À lire en premier, avant le code. Ce document dit où vit chaque chose : le code, le site
en ligne, les données, les clés, les noms de domaine. Un développeur qui le lit en entier
doit pouvoir, sans rien demander à personne d'autre que les accès, faire tourner les deux
sites sur sa machine et comprendre ce qu'il ne faut pas casser.

> Ce fichier existe à l'identique dans les deux dépôts. Si vous le modifiez, reportez la
> modification dans l'autre : deux versions divergentes valent moins que pas de document
> du tout.

---

## 1. Deux sites, deux sociétés, une même pile technique

| | **Staytle** | **IB Signature** |
|---|---|---|
| Objet | Place de marché de location meublée moyenne durée (28 nuits à 11 mois) | Vitrine de la conciergerie premium, Casablanca et Marrakech |
| Entité | Partners Hotels SARL AU | Partners Hotels SARL AU |
| Dépôt | `github.com/amineboughaleb/staytle` (privé) | `github.com/amineboughaleb/ib-signature` (privé) |
| Domaine | `staytle.com` | `ibsignature.com` |
| Pile | Next.js 15 (App Router) · React 19 · SQLite via `better-sqlite3` · TypeScript | identique |
| Port en local | 3000 | 3100 |
| Hébergeur | Railway, image Docker | Railway, image Docker |
| Réservation | prise sur le site, paiement par virement, aucune carte | déléguée à Lodgify, le site ne voit aucune carte |

Même pile des deux côtés, délibérément : un développeur qui prend l'un prend l'autre sans
réapprendre.

---

## 2. Le code

Les deux dépôts sont privés et hébergés chez GitHub. **Le dépôt est la source de vérité**,
pas le disque de qui que ce soit. La branche de travail et de production est `main`.

```bash
git clone https://github.com/amineboughaleb/staytle.git
git clone https://github.com/amineboughaleb/ib-signature.git
```

**Pousser sur `main` déploie.** Railway est branché sur chaque dépôt : un `git push`
déclenche la construction de l'image et la mise en ligne. Il n'y a pas d'étape manuelle,
et il n'y a donc pas non plus de filet : ce qui part sur `main` part en production.

Trois familles de fichiers ne montent jamais dans les dépôts, et les `.gitignore` s'en
chargent : les secrets (`.env*`), les bases de données (`*.db`), et les documents
nominatifs produits par l'application (contrats, `legal/*.docx`). Avant un commit
inhabituel, la vérification coûte une seconde :

```bash
git status --short | grep -E "\.env|\.db|\.docx|uploads"   # ne doit rien afficher
```

---

## 3. Ce qui tourne où

Tout est chez **Railway**, un service par site, chacun construit depuis son `Dockerfile`.

Ce qu'un développeur doit savoir avant de toucher à quoi que ce soit :

**SQLite écrit dans un fichier.** Chaque service a donc un **volume persistant monté sur
`/data`**, et c'est lui qui porte la base et les photographies déposées depuis
l'administration. Sans ce volume, un déploiement efface tout et rien ne le signale : on
s'en aperçoit en ouvrant l'administration vide. C'est la première chose à vérifier sur un
nouvel environnement.

**Vercel ne convient pas** pour ces deux applications : son système de fichiers est en
lecture seule. Le jour où l'on veut y aller, il faut passer à PostgreSQL, et seul
`src/lib/db.ts` est à réécrire - tout l'accès aux données y passe.

Le contrôle de santé est sur `/api/health` (Staytle). Il répond même rideau de
préproduction tiré, sinon un site volontairement fermé serait déclaré mort.

### Les noms de domaine

Le registrar est **Namecheap** pour les deux domaines, en BasicDNS.

| Domaine | Où pointe-t-il |
|---|---|
| `staytle.com` | ALIAS `@` vers la cible Railway du service Staytle |
| `www.staytle.com` | CNAME vers la cible Railway **propre au `www`**, puis redirection 308 vers le domaine nu par `src/middleware.ts` |
| `ibsignature.com` | vers le service Railway d'IB Signature |
| `www.ibsignature.com` | CNAME vers `ibsignature.com` |

Deux pièges déjà rencontrés, qui coûtent chacun une demi-journée :

- **Railway donne une cible différente par domaine.** Celle du `www` n'est pas celle du
  domaine nu. Il faut ouvrir « Show DNS records » sur la ligne du domaine concerné.
- **Namecheap n'enregistre pas toujours une modification d'un TXT existant.** Le panneau
  affiche la nouvelle valeur, le DNS continue de servir l'ancienne. Le remède : supprimer
  la ligne, l'ajouter à nouveau.

La messagerie des deux domaines est sur **Google Workspace**, avec SPF, DKIM et DMARC
posés. `staytle.com` est en `p=quarantine` ; `ibsignature.com` est encore en `p=none`, le
temps d'observer les rapports.

---

## 4. Les services tiers, et ce qu'ils tiennent

| Service | Ce qu'il fait | Sans lui |
|---|---|---|
| **Railway** | Héberge les deux sites, porte les volumes et les variables d'environnement | rien ne tourne |
| **Namecheap** | Registrar et DNS des deux domaines | rien n'est joignable |
| **Google Workspace** | Messagerie des deux domaines | plus de courrier entrant |
| **Resend** | Envoi des courriels sortants (demandes, confirmations, relances, avis d'échéance) | les courriels sont écrits dans le journal du serveur, rien ne part, rien n'est perdu |
| **Lodgify** | Channel manager d'IB Signature : catalogue, prix, calendriers, paiements par carte | IB Signature sert un catalogue de repli **sans prix** ; Staytle perd la synchronisation des calendriers |
| **GitHub** | Les deux dépôts, et le déclencheur de déploiement | plus de mise en ligne |
| **Google Search Console** | Indexation et erreurs de balayage | aveugle sur le référencement |

Tous ces comptes sont aujourd'hui au nom personnel d'Amine. **C'est la vraie dépendance du
projet, plus que le code.** La section 10 dit quoi en faire.

---

## 5. Les variables d'environnement

Les valeurs vivent à deux endroits, et **nulle part ailleurs** : dans `.env.local` sur la
machine du développeur, et dans l'onglet Variables du service Railway. Jamais dans le
dépôt, jamais dans un courriel, jamais dans une conversation. Une clé qui circule cesse
d'être une clé et se régénère.

Chaque dépôt porte un `.env.example` qui liste et commente les variables. Résumé :

### Staytle

| Variable | Rôle | Sans elle |
|---|---|---|
| `ADMIN_PASSWORD` | entrée dans `/admin` | **le serveur refuse de démarrer** |
| `SESSION_SECRET` | signature des cookies de session, 24 caractères au moins | **le serveur refuse de démarrer** |
| `DATABASE_PATH` | fichier SQLite, `/data/staytle.db` en production | base hors du volume, effacée au déploiement |
| `UPLOAD_DIR` | photographies déposées, `/data/uploads` | photos perdues au déploiement |
| `NEXT_PUBLIC_SITE_URL` | liens canoniques, plan du site, images de partage | liens vers l'adresse inscrite en dur |
| `RESEND_API_KEY` | envoi réel des courriels | courriels dans le journal du serveur |
| `MAIL_FROM`, `MAIL_TO` | expéditeur, et boîte qui reçoit les nouvelles demandes | |
| `LODGIFY_API_KEY` | channel manager | synchronisation inactive |
| `CRON_SECRET` | protège `/api/ical/sync`, `/api/channel/sync`, `/api/loyers/sweep`, `/api/validations/sweep`, `/api/backup` | ces routes **refusent tout le monde** plutôt que de rester ouvertes |
| `SITE_PASSWORD` | rideau de préproduction | **la supprimer ouvre le site au public** |

### IB Signature

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | entrée dans `/admin`, obligatoire |
| `ADMIN_SECRET` | signe le cookie de session ; à défaut, `ADMIN_PASSWORD` en tient lieu |
| `DATA_DIR` | `/data` en production : base et photographies |
| `SITE_URL` | `https://ibsignature.com` |
| `LODGIFY_API_KEY` | lecture seule du catalogue, des prix et des disponibilités |
| `RESEND_API_KEY`, `MAIL_FROM`, `AUDIT_TO` | courriels sortants et boîte des demandes d'audit |
| `CRON_SECRET` | protège `POST /api/flux`, la relecture nocturne des calendriers |

Pour engendrer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Démarrer en local

Node 20 ou plus. Depuis le dossier du projet, jamais depuis son parent.

```bash
npm install
cp .env.example .env.local     # puis renseigner ADMIN_PASSWORD et SESSION_SECRET
npm run dev                    # Staytle sur 3000, IB Signature sur 3100
```

> **Ne relancez jamais `cp .env.example .env.local` sur une installation qui marche** : la
> commande écrase mot de passe, secret de session et clés d'API.

Sur Staytle, `npm run seed` crée la base et charge les annonces au **premier** démarrage.
Il installe, il ne met pas à jour : une annonce déjà en base reste intacte. C'est
délibéré - une fois le site en service, la base est la source de vérité, et réécrire
depuis `data/import/` remettrait d'anciennes adresses de photos qui ne répondent plus.

Contrôles :

```bash
npx tsc --noEmit       # le typage, avant tout le reste
npm run build          # la compilation de production
npm run e2e            # Staytle : parcours de bout en bout (Playwright)
npm run verifier       # IB Signature : contrôles de bout en bout, serveur démarré
npm run doctor         # Staytle : état de la base et des réglages
```

---

## 7. Déployer

```bash
git add -A
git commit -m "ce que vous venez de changer"
git push
```

C'est tout, et c'est tout ce qu'il faut faire.

> **N'utilisez pas `railway up`.** Il envoie l'état du disque, y compris ce qui n'est pas
> commité : le site en ligne se met alors à diverger de l'historique, et plus rien ne dit
> ce qui tourne réellement. Il reste un moyen de dépannage si GitHub est indisponible.

Les détails propres à chaque site - volume, entrypoint, premier démarrage, certificats -
sont dans `DEPLOY.md` (Staytle) et `MISE-EN-LIGNE.md` (IB Signature).

---

## 8. Les données, c'est-à-dire ce qui ne se réécrit pas

Le code se réécrit. Les dossiers des locataires, les baux signés, les calendriers, les
réglages et les coordonnées bancaires, non.

La base de chaque site est un fichier SQLite sur le volume Railway, **sans aucune
redondance**. Sauvegarde :

- **Staytle** : `/admin/settings` → « Télécharger la base ». Ou, automatisable :
  `curl -s -H "Authorization: Bearer $CRON_SECRET" https://staytle.com/api/backup -o staytle-$(date +%F).db`
- **IB Signature** : Admin → Réglages → Sauvegarde → « Télécharger la base ».

> **Ne copiez jamais un fichier `.db` à la main depuis l'explorateur.** SQLite écrit
> d'abord dans un fichier d'attente (`.db-wal`) et ne le reverse que de temps en temps :
> une copie manuelle perd les dernières écritures, parfois plusieurs jours, sans le
> moindre message d'erreur. Le bouton, lui, reverse avant de copier.

**Aucune sauvegarde automatique n'existe aujourd'hui.** C'est le risque ouvert le plus
sérieux du projet : à mettre en place avant toute autre amélioration.

---

## 9. Les tâches planifiées

Chacune est protégée par `CRON_SECRET` et refuse tout le monde si le secret n'est pas
défini. Aucune n'est sensible à la fréquence d'appel : un envoi déjà fait n'est jamais
refait, un envoi manqué repart au passage suivant.

```
# Staytle - calendriers iCal entrants, toutes les heures
0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://staytle.com/api/ical/sync

# Staytle - avis d'échéance, relances de loyer, conformité à l'arrivée
0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://staytle.com/api/loyers/sweep

# Staytle - validations bailleur dont le délai est écoulé
0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://staytle.com/api/validations/sweep

# IB Signature - relecture nocturne des calendriers, 3 h à Casablanca
0 3 * * * curl -fsS -X POST https://ibsignature.com/api/flux -H "x-cron-secret: $CRON_SECRET"
```

`/api/loyers/sweep` n'envoie qu'entre 8 h et 20 h, heure de Casablanca : un branchement
horaire est donc sans danger.

---

## 10. Avant d'accueillir un développeur

Cinq gestes, dans cet ordre. Les trois premiers prennent une demi-journée et évitent des
années d'ennuis.

1. **Créer une organisation GitHub au nom de Partners Hotels et y transférer les deux
   dépôts.** Le transfert conserve l'historique, les adresses et les branchements Railway.
   Ce qui change : le code appartient à la société et non à une personne, un accès se
   donne et se retire sans toucher au compte d'Amine, et le projet survit si ce compte
   disparaît. Activer la double authentification obligatoire sur l'organisation.
2. **Donner des accès nominatifs partout où c'est possible** : GitHub, Railway, Google
   Workspace, Search Console. Un mot de passe partagé ne se retire pas, il se change - et
   on oublie toujours de le changer.
3. **Régénérer les clés d'API qui ont circulé** : Lodgify et Resend en premier. Une clé
   dont on n'est pas certain du trajet est une clé à remplacer.
4. **Mettre en place la sauvegarde automatique des deux bases** (section 8), rangée
   ailleurs que chez Railway.
5. **Remplacer le mot de passe unique de l'administration Staytle par des comptes
   nominatifs.** Le modèle des utilisateurs existe déjà - il sert aux exploitants - mais
   l'équipe Staytle partage encore une seule entrée. Suffisant pour un MVP, pas pour une
   équipe.

Et une règle de travail, qui a tenu jusqu'ici et mérite d'être dite à qui arrive :
**aucune clé, aucun mot de passe ne transite par une conversation, un courriel ou un
fichier partagé.** On les copie de leur source à leur destination, directement.

---

## 11. Où se trouve la documentation

| Fichier | Contenu |
|---|---|
| `README.md` (Staytle) | ce que fait l'application, écran par écran, et les règles de prix |
| `DEPLOY.md` (Staytle) | mise en ligne, volume, domaines, sauvegarde, tâches planifiées |
| `JOURNAL.md` (Staytle) | **les décisions et leurs raisons**, par date. Ce qu'un `git log` ne dit pas |
| `README.md` (IB Signature) | le partage des rôles avec Lodgify, et pourquoi il est ainsi |
| `MISE-EN-LIGNE.md` (IB Signature) | mise en ligne pas à pas, et les trois pièges |
| `DEPLOIEMENT-BATCH.md` (IB Signature) | le service de rafraîchissement nocturne des calendriers |
| Projet STAYTLE sur claude.ai | charte de marque, spécification des dossiers d'admission, business plan |

Le code lui-même est commenté en français, et les commentaires disent **pourquoi** plutôt
que quoi. C'est là que se trouve l'essentiel de ce qui n'est écrit nulle part ailleurs :
lisez les en-têtes de `src/lib/pricing.ts`, `src/lib/echeancier.ts` et
`src/lib/admission.ts` avant d'y toucher.

---

## À compléter

Quelques éléments qu'un développeur ne peut pas deviner et qui ne sont écrits nulle part.
À renseigner ici une fois pour toutes :

- [ ] Nom exact des deux services Railway et du projet qui les contient
- [ ] Adresse du compte Railway, du compte Resend et du compte Lodgify (qui les détient)
- [ ] Identifiant du compte Namecheap
- [ ] Emplacement convenu des sauvegardes de bases
- [ ] État de `conciergerie.ibsignature.com` : sous-domaine encore servi, ou à retirer
