# IB Signature

Le site de la conciergerie : vitrine, sélection d'appartements, et section
propriétaires. Bilingue français-anglais, français par défaut.

## Le partage avec Lodgify

Ce site **ne prend aucune réservation et ne voit aucune carte bancaire**. C'est
délibéré : Lodgify tient déjà les paiements, les calendriers et la
synchronisation vers Airbnb et Booking. Reconstruire cela ici, ce serait
déplacer la vérité des disponibilités hors de l'endroit où elle est juste, et
créer le risque d'une double réservation.

Le partage est donc :

- **le site** possède tout ce qui précède la décision : l'accueil, la recherche,
  les fiches, les quartiers, la section propriétaires ;
- **Lodgify** possède la transaction. Le bouton « Réserver » ouvre la page de
  réservation du bien, dates et nombre de voyageurs déjà remplis.

L'inventaire est lu chez Lodgify, en lecture seule : aucune écriture n'est
possible depuis ce site, et rien de ce code ne peut abîmer un calendrier dont
dépendent trois plateformes.

## Sans clé d'API

Le site ne tombe pas. Il sert le catalogue de repli de
`data/enrichissement.json` : des noms et des quartiers, **jamais un prix**. Un
prix faux est pire qu'un prix absent, et le bouton de réservation mène alors à
l'accueil du moteur plutôt qu'à un identifiant fabriqué.

## L'enrichissement

`data/enrichissement.json` porte ce que Lodgify ne sait pas dire : un ordre
d'affichage, une mise en avant, un texte de quartier. Les clés sont les
identifiants Lodgify. Rien de ce qui vit chez Lodgify n'est recopié ici.

## Commandes

```
npm install
npm run dev        # développement, port 3100
npm run build
npm start
npm run verifier   # 27 contrôles de bout en bout, serveur démarré
```

## Variables d'environnement

Voir `.env.example`. Aucune n'est obligatoire pour démarrer ; sans elles, le
site fonctionne en mode dégradé et le dit.
