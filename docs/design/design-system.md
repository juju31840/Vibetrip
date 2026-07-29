# VibeTrip — Design System (condensé)

> Document de référence pour le design visuel de VibeTrip. Basé sur les tokens déjà définis dans `tailwind.config.ts` et sur l'implémentation existante des composants (`components/ui/*`, `components/*`). Ce document ne redéfinit rien dans le code — il documente et complète ce qui existe pour guider les décisions visuelles à venir.

---

## 1. Tokens couleur

### 1.1 Palette de base (existante, `tailwind.config.ts`)

| Token | Hex | Usage |
|---|---|---|
| `background` | `#0B0B12` | Fond de page global (noir profond, légèrement bleuté) |
| `surface` | `#15151C` | Cartes, boutons secondaires, bottom sheet, inputs |
| `surface-alt` | `#1E1E27` | Fond de piste des curseurs (track), éléments en 2e plan sur une `surface` |
| `border` | `#2A2A35` | Bordures des cartes/boutons/inputs, poignée de la bottom sheet |
| `text-primary` | `#F5F5F7` | Titres, texte principal, valeurs actives |
| `text-secondary` | `#9A9AA5` | Sous-titres, labels, descriptions, texte non actif |
| `brand-gradient` | `linear-gradient(90deg, #4F46E5 0%, #A855F7 100%)` | CTA principal, mode sélectionné, step card active |

### 1.2 Extensions sémantiques recommandées (nouvelles, non encore dans le code)

Utiles pour les futurs états d'erreur/succès (ex. `ErrorState`, validations de formulaire, badges de statut) :

| Token | Hex | Usage |
|---|---|---|
| `success` | `#22C55E` | Confirmation, badge "disponible" (déjà utilisé comme couleur de marqueur `park`) |
| `error` | `#F87171` | Message d'erreur, bordure d'input invalide |
| `warning` | `#FBBF24` | Avertissement non bloquant (ex. quota API proche de la limite) |
| `info` | `#38BDF8` | Info neutre (déjà utilisé comme couleur de marqueur `museum`/`viewpoint`) |

Ces couleurs restent cohérentes avec `TYPE_COLORS` déjà défini dans `components/MapView.tsx` (réutilisation intentionnelle, pas de nouvelle couleur inventée sans lien avec l'existant).

### 1.3 Couleurs des types de lieux (marqueurs carte — existant, `MapView.tsx`)

| Type | Hex |
|---|---|
| `restaurant` | `#F97316` |
| `bar` / `nightlife` | `#A855F7` |
| `cafe` | `#D97706` |
| `museum` / `viewpoint` | `#38BDF8` |
| `park` | `#22C55E` |
| `activity` | `#4F46E5` |
| `shopping` | `#EC4899` |
| `hotel` | `#F5F5F7` |
| `transport` / `other` | `#9A9AA5` |

Anneau de sélection (marqueur actif) : `box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.5)`.

---

## 2. Typographie

Police : **Manrope** (chargée via `next/font/google` dans `app/layout.tsx`), sans-serif géométrique, bonne lisibilité sur fond sombre.

| Niveau | Taille / Tailwind | Poids | Usage |
|---|---|---|---|
| Titre principal (H1) | 24px / `text-2xl` | 600 (semibold) | Titre "VibeTrip" écran d'accueil |
| Corps standard | 14px / `text-sm` | 400–500 | Descriptions, sous-titres, texte de bouton |
| Nom de lieu (step card) | 16px / `text-base` | 500 (medium) | `placeName` dans `StepCard` |
| Label / eyebrow | 12px / `text-xs`, uppercase, `tracking-wide` | 500 | Période ("Matin/Midi/Soir"), labels de curseur |
| Titre de section secondaire | 14px / `text-sm` | 600 (semibold), couleur `text-secondary` | "Jour 1", "Jour 2" dans la bottom sheet |

Règle générale : le texte informatif/de support est toujours en `text-secondary`, le texte à forte valeur (nom de lieu, valeur de curseur, titre) passe en `text-primary`.

---

## 3. Rayons de bordure

| Token | Valeur | Usage |
|---|---|---|
| `rounded-xl` | 0.75rem (12px) | Champs de saisie (input ville) |
| `rounded-2xl` | 1rem (16px) | Cartes, boutons de mode, step cards |
| `rounded-full` | 9999px | Boutons pill (CTA, secondary, ghost), poignée de drag |
| `sheet` (custom) | 1.5rem (24px) | Coins supérieurs de la bottom sheet uniquement (`rounded-t-sheet`) |

---

## 4. Espacements standards

Basé sur l'échelle Tailwind par défaut (grille 4px), valeurs déjà utilisées dans le code :

- Padding de page (écran d'accueil) : `px-6 py-10`
- Espacement entre grandes sections (curseurs / mode / localisation) : `gap-8`
- Espacement entre curseurs : `gap-5`
- Espacement grille des 3 boutons de mode : `gap-3`
- Padding interne carte/bouton/step card : `px-4 py-3`
- Espacement label/valeur d'un curseur : `gap-2`
- Marge basse entre groupes de jours (bottom sheet) : `mb-6`

---

## 5. États des composants

### 5.1 Bouton (`components/ui/Button.tsx`)

| Variante | Défaut | Désactivé | Pression (`active`) |
|---|---|---|---|
| `primary` | `brand-gradient`, texte `text-primary`, `shadow-lg shadow-black/30` | `opacity-40`, `cursor-not-allowed` | `opacity-80` |
| `secondary` | fond transparent, bordure `border`, texte `text-primary` | `opacity-40` | `opacity-80` |
| `ghost` | texte `text-secondary`, transparent | — | texte devient `text-primary` au survol |

Recommandation à ajouter (non présente dans le code actuel) : un état **focus-visible** distinct (ex. `outline: 2px solid #A855F7; outline-offset: 2px`) pour la navigation clavier — actuellement seul l'état `active:` (tactile) est stylé.

### 5.2 Curseur / Slider (`components/ui/Slider.tsx`)

- Track : `surface-alt` (#1E1E27), hauteur 8px (`h-2`), `rounded-full`.
- Curseur natif (`accent-color: #A855F7`) : le thumb et la portion remplie prennent la couleur violette de marque.
- État "au drag" (recommandé, non explicite dans le CSS actuel) : agrandir légèrement le thumb (+15%) et ajouter une lueur douce (`box-shadow: 0 0 0 6px rgba(168,85,247,0.25)`) pour un retour visuel clair pendant le glissement tactile.
- Valeur affichée en `text-primary`, label en `text-secondary`, sur une même ligne (`justify-between`).

### 5.3 Bouton de mode (`components/ModeSelector.tsx`)

| État | Style |
|---|---|
| Non sélectionné | `bg-surface`, `border-border`, texte `text-secondary` |
| Sélectionné (actif) | `bg-brand-gradient`, `border-transparent`, texte `text-primary` |

Transition : `transition-colors` (changement de couleur progressif au clic, pas d'animation de taille).

### 5.4 Step card (bottom sheet)

| État | Style |
|---|---|
| Inactive | `bg-surface`, `border-border` |
| Active (sélectionnée) | `bg-brand-gradient`, `border-transparent` — même traitement visuel que le mode actif, pour cohérence de langage "sélection = dégradé" |

### 5.5 Bottom sheet — 3 snap points (`components/ItineraryBottomSheet.tsx`)

Points de snap définis dans le code : `[0.2, 0.55, 0.92]` (fractions de la hauteur de viewport), valeur par défaut au montage : `0.55`.

| Snap | Hauteur | Intention visuelle |
|---|---|---|
| 20% | Peek | Poignée + en-tête "Jour X" à peine visible ; la carte occupe presque tout l'écran. Utile pour se concentrer sur la carte. |
| 55% (défaut) | Mi-hauteur | 2–3 step cards visibles, carte encore visible en haut — équilibre carte/liste. |
| 92% | Presque plein écran | Liste quasi complète de l'itinéraire, carte réduite à une fine bande en haut — mode "consultation d'itinéraire". |

Poignée de drag : barre `h-1.5 w-10 rounded-full bg-border`, centrée en haut de la sheet, sert d'affordance visuelle de glissement.

### 5.6 Champ de localisation (`components/LocationInput.tsx`)

| État | Style |
|---|---|
| Idle (rien détecté) | Bouton `secondary`, texte "Utiliser ma position" |
| En cours (`locating`) | Bouton `secondary` désactivé, texte "Localisation..." |
| Détecté | Bouton `primary`, texte "Position détectée" |
| Refusé (`denied`) | Affiche un champ texte "Ou entre une ville de départ" |

---

## 6. Recommandations d'accessibilité

### 6.1 Contraste (fond sombre)

Ratios calculés (WCAG 2.1, formule de luminance relative) :

| Paire | Ratio | Verdict |
|---|---|---|
| `text-primary` (#F5F5F7) / `background` (#0B0B12) | ≈ 18:1 | Excellent (AAA) |
| `text-secondary` (#9A9AA5) / `background` (#0B0B12) | ≈ 7.0:1 | Conforme AA et AAA (texte normal) |
| `text-secondary` (#9A9AA5) / `surface` (#15151C) | ≈ 6.5:1 | Conforme AA/AAA |
| `text-primary` sur `brand-gradient`, extrémité indigo (#4F46E5) | ≈ 5.8:1 | Conforme AA |
| `text-primary` sur `brand-gradient`, extrémité violette (#A855F7) | **≈ 3.6:1** | **Non conforme AA (4.5:1) pour texte normal 14px** |

**Point d'attention** : le texte du CTA principal, des boutons de mode actifs et des step cards actives passe sous le seuil AA lorsqu'il chevauche la portion violette du dégradé (côté droit). Recommandations :
- Passer le texte de ces éléments en `font-semibold` (600) plutôt que `font-medium` (500) — n'atteint pas le seuil "texte large en gras" (14pt/18.7px bold) mais réduit visuellement le problème ;
- Ou ajouter une légère ombre portée sur le texte (`text-shadow: 0 1px 2px rgba(0,0,0,0.35)`) pour améliorer la lisibilité perçue sans changer la palette ;
- Ou assombrir légèrement l'extrémité violette du dégradé (ex. `#9333EA` au lieu de `#A855F7`) si la marque le permet — impact minime sur l'identité visuelle.

### 6.2 Taille des zones tactiles (mobile)

- Boutons (`Button`, `ModeSelector`, `StepCard`) : `py-3` + texte ≈ 44–48px de hauteur → conforme à la cible minimale de 44×44px (WCAG 2.5.5 / Apple HIG).
- **Curseur natif (`<input type="range">`)** : le thumb par défaut du navigateur est souvent < 24px, potentiellement sous la cible tactile recommandée. Recommandation : élargir la zone de préhension avec `padding` vertical invisible autour du track (hit-area ≥ 44px de haut) sans changer l'épaisseur visuelle de la piste (8px).
- Poignée de la bottom sheet : élargir sa zone cliquable au-delà des 6px visuels (ex. `padding: 12px 0` autour de la barre) pour faciliter la préhension au pouce.

### 6.3 Autres recommandations

- **Focus clavier** : ajouter un `outline` visible (`focus-visible`) sur tous les éléments interactifs — actuellement seuls les états `hover`/`active` tactiles sont stylés.
- **Couleur seule pour distinguer les types de lieux** (marqueurs carte) : les 12 `PlaceType` sont différenciés uniquement par couleur, ce qui pose un problème pour les utilisateurs daltoniens. Recommandation : ajouter une icône ou une forme distincte par catégorie, ou au minimum un libellé au clic/tap.
- **Alternative au geste de drag** : le drag de la bottom sheet n'est pas nativement accessible au clavier. Prévoir un contrôle alternatif (bouton "agrandir/réduire" ou raccourci) pour atteindre les 3 snap points sans geste tactile.
- **`prefers-reduced-motion`** : respecter cette préférence pour l'animation du spinner de chargement et les transitions de hauteur de la bottom sheet (réduire ou supprimer l'animation si l'utilisateur le demande).
- **Lecture d'écran** : la poignée de drag et les indicateurs purement décoratifs doivent être marqués `aria-hidden="true"`; le nom du lieu actif sur la carte doit rester accessible via la liste (déjà le cas via la bottom sheet).
