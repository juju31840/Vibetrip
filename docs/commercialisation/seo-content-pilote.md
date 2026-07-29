# Contenu SEO pilote — copy prête à publier (5 villes)

Applique `docs/conception/seo-programmatique-plan.md` §2-4 : copy réelle pour les 5 villes pilotes
(Paris, Lyon, Bordeaux, Bruxelles, Montréal), modes Tonight/Weekend, 3 niveaux de budget. Ton aligné
sur `docs/commercialisation/landing-page-copy.md` (direct, sans superlatif).

> **Important — ce qui n'est PAS dans ce document** : les listes d'étapes précises (noms de lieux
> réels, adresses) ne sont **pas inventées ici**. Le plan SEO (§5) est explicite : un itinéraire
> public et durable doit venir du pipeline réel (`lib/claude.ts`) puis être relu humainement avant
> publication — jamais halluciné a priori. Ce document couvre uniquement l'intro, la FAQ et les
> métadonnées, qui ne nomment aucun lieu précis et sont donc publiables sans ce risque.

---

## Gabarit de page

```
/{mode}-a-{ville}-{budget}
<title>{Mode label} à {Ville} : itinéraire {budget label} | VibeTrip</title>
<meta description>{1 phrase reprenant l'intro + CTA implicite}
```

Structure de contenu : Hook ville (fixe par ville) → Intro mode+budget (variable) → [Timeline générée
par le pipeline réel, non couverte ici] → FAQ (2-3 Q/R par mode) → CTA vers l'outil interactif.

---

## Paris

**Hook ville** (fixe, réutilisé sur les 6 pages Paris) :
> Paris se prête aussi bien à une soirée improvisée qu'à un week-end complet — la difficulté n'est
> jamais de trouver quoi faire, mais de choisir parmi trop d'options.

### Tonight à Paris
- Slug : `/ce-soir-a-paris-{budget}`
- Intro petit budget : "Ce soir, pas besoin de gros budget pour bien sortir à Paris : quartiers
  animés, terrasses accessibles et ambiance conviviale sans se ruiner."
- Intro modéré : "Ce soir à Paris, une sortie équilibrée entre bonne table et ambiance, sans viser
  le grand restaurant ni le bar le moins cher du quartier."
- Intro confortable : "Ce soir à Paris, place à une sortie plus soignée — un cadre plus haut de
  gamme, pensé pour marquer une occasion sans devoir réserver un mois à l'avance."
- FAQ :
  - *Faut-il réserver à l'avance pour sortir ce soir à Paris ?* Dans les quartiers les plus animés,
    certains lieux populaires se remplissent vite le week-end — mieux vaut avoir un plan B si le
    premier lieu affiche complet.
  - *Quel budget prévoir pour une soirée à Paris ?* Ça varie énormément selon le quartier et le type
    de sortie — VibeTrip ajuste ses propositions selon le budget que vous réglez, plutôt que de
    viser un tarif unique.

### Weekend à Paris
- Slug : `/weekend-a-paris-{budget}`
- Intro petit budget : "Un week-end à Paris petit budget, c'est possible : musées gratuits certains
  jours, quartiers à explorer à pied, et de quoi bien manger sans exploser le budget."
- Intro modéré : "Un week-end équilibré à Paris, entre incontournables et adresses plus
  confidentielles, sans multiplier les dépenses superflues."
- Intro confortable : "Un week-end plus confortable à Paris, avec des adresses plus soignées et un
  rythme moins serré, pour profiter sans compter chaque euro."
- FAQ :
  - *Deux jours suffisent-ils pour un week-end à Paris ?* Oui pour un aperçu ciblé sur un ou deux
    quartiers — mieux vaut se concentrer que vouloir tout voir en 48h.
  - *Quelle est la meilleure période pour un week-end à Paris ?* La ville se vit toute l'année ;
    le printemps et le début d'automne évitent les pics de fréquentation touristique les plus forts.

---

## Lyon

**Hook ville** :
> Lyon a une identité claire — gastronomie reconnue, bouchons typiques, ambiance conviviale plutôt
> que festive à tout prix — qui se prête particulièrement bien à une sortie ou un week-end réglé
> sur l'ambiance plutôt que sur une liste de monuments.

### Tonight à Lyon
- Slug : `/ce-soir-a-lyon-{budget}`
- Intro petit budget : "Ce soir à Lyon, une sortie simple et conviviale suffit — pas besoin de
  viser une grande table pour bien manger dans cette ville."
- Intro modéré : "Ce soir à Lyon, un équilibre entre bouchon traditionnel et ambiance de quartier,
  sans viser l'adresse la plus chère."
- Intro confortable : "Ce soir à Lyon, une sortie plus soignée, pour profiter de la réputation
  gastronomique de la ville sans compter."
- FAQ :
  - *Qu'est-ce qu'un bouchon lyonnais ?* Un type de restaurant traditionnel typique de Lyon, souvent
    convivial et copieux — une bonne option pour une soirée qui veut être authentique sans être
    guindée.
  - *Lyon est-elle une ville chère le soir ?* Moins que Paris en général, avec une offre large sur
    tous les niveaux de budget.

### Weekend à Lyon
- Slug : `/weekend-a-lyon-{budget}`
- Intro petit budget : "Un week-end à Lyon petit budget reste facile : la ville se découvre bien à
  pied, entre Presqu'île et quartiers historiques, sans dépenses obligatoires."
- Intro modéré : "Un week-end équilibré à Lyon, entre gastronomie et balades, sans multiplier les
  extras."
- Intro confortable : "Un week-end plus confortable à Lyon, pour profiter pleinement de sa scène
  gastronomique reconnue."
- FAQ :
  - *Deux jours suffisent-ils à Lyon ?* Oui pour couvrir le centre-ville à un bon rythme, sans se
    presser.
  - *Lyon est-elle adaptée à un week-end en couple ?* Oui, souvent citée comme alternative plus
    posée à Paris pour une escapade courte.

---

## Bordeaux

**Hook ville** :
> Bordeaux conjugue vin, architecture XVIIIe et une ambiance plus douce que festive — une ville qui
> se prête bien à un rythme tranquille, en soirée comme sur un week-end complet.

### Tonight à Bordeaux
- Slug : `/ce-soir-a-bordeaux-{budget}`
- Intro petit budget : "Ce soir à Bordeaux, une sortie simple autour d'un verre et d'une terrasse
  suffit largement pour profiter de l'ambiance de la ville."
- Intro modéré : "Ce soir à Bordeaux, un équilibre entre dégustation et repas, sans viser l'adresse
  la plus prestigieuse."
- Intro confortable : "Ce soir à Bordeaux, une sortie plus soignée autour du vin et de la
  gastronomie locale."
- FAQ :
  - *Faut-il s'y connaître en vin pour sortir à Bordeaux ?* Non, la ville propose des options
    accessibles à tous les niveaux de curiosité, pas seulement aux amateurs avertis.
  - *Bordeaux est-elle une ville animée le soir ?* Plus posée que festive en général — cohérente
    avec une sortie calme ou conviviale plutôt qu'une soirée très intense.

### Weekend à Bordeaux
- Slug : `/weekend-a-bordeaux-{budget}`
- Intro petit budget : "Un week-end à Bordeaux petit budget passe surtout par la marche : le centre
  historique se découvre bien à pied, sans dépense obligatoire."
- Intro modéré : "Un week-end équilibré à Bordeaux, entre visites et dégustations, à un rythme
  tranquille."
- Intro confortable : "Un week-end plus confortable à Bordeaux, pour profiter pleinement de sa
  réputation autour du vin."
- FAQ :
  - *Deux jours suffisent-ils à Bordeaux ?* Oui pour le centre-ville ; les amateurs de vin peuvent
    envisager une extension vers les environs, hors du périmètre d'un simple week-end en ville.
  - *Bordeaux convient-elle à un week-end sans voiture ?* Le centre-ville est compact et se visite
    bien à pied ou à vélo.

---

## Bruxelles

**Hook ville** :
> Bruxelles mélange bière, bande dessinée et statut de capitale européenne — une ambiance à la fois
> conviviale et cosmopolite, qui fonctionne aussi bien pour une soirée que pour un week-end complet.

### Tonight à Bruxelles
- Slug : `/ce-soir-a-bruxelles-{budget}`
- Intro petit budget : "Ce soir à Bruxelles, une sortie simple autour d'un bar à bières suffit pour
  profiter de l'ambiance conviviale de la ville."
- Intro modéré : "Ce soir à Bruxelles, un équilibre entre spécialités locales et sortie animée, sans
  viser l'adresse la plus chère."
- Intro confortable : "Ce soir à Bruxelles, une sortie plus soignée pour découvrir la scène
  gastronomique de la capitale belge."
- FAQ :
  - *Bruxelles est-elle une ville francophone ?* Bilingue (français/néerlandais), avec une vie
    nocturne largement accessible en français.
  - *Quel est le meilleur quartier pour sortir le soir à Bruxelles ?* Ça dépend surtout de
    l'ambiance recherchée — VibeTrip ajuste la proposition selon le curseur Ambiance plutôt que de
    recommander un seul quartier universel.

### Weekend à Bruxelles
- Slug : `/weekend-a-bruxelles-{budget}`
- Intro petit budget : "Un week-end à Bruxelles petit budget reste facile : musées à tarif réduit
  certains jours, centre historique compact à explorer à pied."
- Intro modéré : "Un week-end équilibré à Bruxelles, entre patrimoine et spécialités locales, sans
  dépenses superflues."
- Intro confortable : "Un week-end plus confortable à Bruxelles, pour profiter pleinement de son
  offre gastronomique et culturelle."
- FAQ :
  - *Deux jours suffisent-ils à Bruxelles ?* Oui pour le centre historique ; la ville reste compacte
    à l'échelle d'un week-end.
  - *Bruxelles est-elle adaptée à un week-end entre amis ?* Oui, souvent citée pour son ambiance
    conviviale et son accessibilité depuis plusieurs grandes villes européennes.

---

## Montréal

**Hook ville** :
> Montréal offre une ambiance francophone nord-américaine assez unique — plus décontractée qu'en
> Europe, avec une vraie scène festive — qui se prête bien à une sortie ou un week-end pensé sur
> l'ambiance plutôt que sur une liste de monuments à cocher.

### Tonight à Montréal
- Slug : `/ce-soir-a-montreal-{budget}`
- Intro petit budget : "Ce soir à Montréal, une sortie simple dans un quartier animé suffit pour
  profiter de l'ambiance décontractée de la ville."
- Intro modéré : "Ce soir à Montréal, un équilibre entre bonne table et sortie festive, sans viser
  l'adresse la plus chère."
- Intro confortable : "Ce soir à Montréal, une sortie plus soignée pour découvrir une scène
  culinaire reconnue en Amérique du Nord."
- FAQ :
  - *Le décalage horaire complique-t-il une soirée improvisée à Montréal ?* Non, ce point concerne
    le voyageur international, pas la vie nocturne locale elle-même.
  - *Montréal est-elle une ville chère le soir ?* Globalement plus accessible que beaucoup de
    grandes villes nord-américaines, avec une large offre à tous les niveaux de budget.

### Weekend à Montréal
- Slug : `/weekend-a-montreal-{budget}`
- Intro petit budget : "Un week-end à Montréal petit budget passe bien par la marche et le vélo :
  quartiers à explorer sans dépense obligatoire, ambiance décontractée toute l'année."
- Intro modéré : "Un week-end équilibré à Montréal, entre quartiers à découvrir et bonnes tables,
  à un rythme détendu."
- Intro confortable : "Un week-end plus confortable à Montréal, pour profiter pleinement de sa scène
  culinaire et festive."
- FAQ :
  - *Deux jours suffisent-ils à Montréal ?* Oui pour un ou deux quartiers à bon rythme ; la ville
    est plus étendue que les villes européennes du pilote, mieux vaut cibler large plutôt que
    vouloir tout couvrir.
  - *Faut-il prévoir une voiture pour un week-end à Montréal ?* Le centre et les quartiers
    principaux se couvrent bien à pied, à vélo ou en transport en commun.

---

## Ce qui reste à faire pour publier réellement (hors de ce document)

1. Générer la timeline réelle (lieux, description, coordonnées) pour chacune des 30 combinaisons via
   `lib/claude.ts`, en environnement testable (Node.js disponible).
2. Relire humainement chaque timeline générée (existence réelle des lieux, cohérence géographique) —
   cf. `seo-programmatique-plan.md` §5, non négociable pour du contenu public durable.
3. Assembler page finale : hook + intro (ce document) + timeline générée et relue + FAQ (ce document)
   + CTA vers l'outil interactif.
4. Implémenter les pages (`app/(seo)/[slug]/page.tsx`), le sitemap et le JSON-LD — travail de code,
   à faire une fois Node.js disponible.
