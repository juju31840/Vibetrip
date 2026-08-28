"""
Charge le socle de lieux dans Supabase depuis Foursquare OS Places.

Ce pipeline a d'abord vécu dans un dossier temporaire, où il aurait été perdu. Il est ici parce
qu'il devra être rejoué : le référentiel sort une version par mois, et le socle vieillit.

    python3 scripts/ingest-places.py --source miroir          # miroir public (février 2025)
    python3 scripts/ingest-places.py --source catalogue       # catalogue Foursquare, plus frais
    python3 scripts/ingest-places.py --source miroir --sec    # sans écrire en base

Dépendances : duckdb (`pip install duckdb`). Aucune autre.

Trois choses apprises en le construisant, toutes payées cher :

1. **Liste blanche, pas liste noire.** Le premier filtrage laissait entrer 24 612 villes et
   villages, 15 962 « Structure », 9 440 parkings et, via un `Retail%` trop large, les
   supermarchés et les concessionnaires. Le référentiel compte des centaines de sous-catégories
   dont la plupart ne sont pas des sorties : énumérer ce qu'on veut est vérifiable, exclure ce
   qu'on ne veut pas ne l'est jamais.

2. **La fraîcheur n'est pas un critère d'exclusion.** Un seuil « rafraîchi depuis 2022 » faisait
   disparaître Chez Marcelle, vrai bouchon lyonnais toujours ouvert dont la fiche n'a pas bougé
   depuis 2019 — c'est-à-dire exactement les petites adresses qui font la valeur du produit.
   L'ancienneté sert à *prioriser la vérification*, jamais à écarter.

3. **Le pare-feu de Supabase rejette le User-Agent par défaut de Python** par un 403. Le symptôme
   fait chercher du côté du SQL ou de la taille des lots ; ce n'est ni l'un ni l'autre.
"""

import argparse
import json
import os
import sys
import time
import urllib.request

MIROIR = "https://data.source.coop/fused/fsq-os-places/2025-02-06/places/"
CATALOGUE = "https://catalog.h3-hub.foursquare.com/iceberg"

# Les 12 fichiers du miroir dont la bbox intersecte la France métropolitaine, repérés en lisant
# les seules métadonnées : 2,4 Go au lieu de 16,9.
FICHIERS_FRANCE = (24, 25, 27, 29, 30, 31, 33, 34, 37, 38, 39, 40)

GARDER = [
    "Dining and Drinking > Restaurant", "Dining and Drinking > Bar",
    "Dining and Drinking > Cafe", "Dining and Drinking > Bakery",
    "Dining and Drinking > Dessert", "Dining and Drinking > Bistro",
    "Dining and Drinking > Brewery", "Dining and Drinking > Winery",
    "Dining and Drinking > Distillery", "Dining and Drinking > Food Court",
    "Museum", "Art Gallery", "Performing Arts Venue", "Movie Theater", "Opera House",
    "Historic and Protected Site", "Monument", "Memorial Site", "Castle", "Palace",
    "Cathedral", "Church", "Abbey", "Temple", "Synagogue", "Mosque", "Library",
    "Cultural Center", "Exhibit", "Planetarium", "Aquarium", "Zoo",
    "Landmarks and Outdoors > Park", "Garden", "Botanical Garden", "Plaza", "Beach",
    "Scenic Lookout", "Nature Preserve", "Trail", "Waterfall", "Lake", "Harbor or Marina",
    "Fountain", "Pedestrian Plaza", "Vineyard",
    "Night Club", "Music Venue", "Concert Hall", "Jazz", "Comedy Club", "Casino",
    "Bookstore", "Fashion Retail", "Antique Store", "Vintage and Thrift Store",
    "Record Shop", "Music Store", "Gift Store", "Jewelry Store", "Flea Market",
    "Farmers Market", "Market", "Souvenir Store", "Chocolate Store", "Cheese Store",
    "Wine Store", "Craft Store", "Art Store", "Perfume Store", "Concept Store",
]

# Priment sur la liste blanche : ces motifs contiennent des mots qu'elle retient
# (« Marché » dans « Supermarket », « Park » dans « Parking », « Garden » dans « Garden Center »).
EXCLURE = [
    "States and Municipalities", "Landmarks and Outdoors > Structure", "Other Great Outdoors",
    "Parking", "Campground", "Supermarket", "Grocery Store", "Convenience Store",
    "Fast Food", "Residential Building", "> Road", "Bus Stop", "Gas Station",
    "Automotive", "Construction Supplies", "Miscellaneous Store", "Pharmacy",
    "Real Estate", "Office", "Bank", "Warehouse Store", "Shopping Mall",
    "Garden Center", "Hardware Store", "Home Improvement", "Furniture",
]

PERMANENT = ("Landmarks and Outdoors", "Museum", "Plaza", "Park", "Historic", "Monument", "Garden")

THEMES = {
    "eat": ("Restaurant", "Bakery", "Bistro", "Diner", "Steakhouse", "Pizzeria", "Creperie"),
    "drink": ("Bar", "Café", "Cafe", "Coffee", "Pub", "Brewery", "Wine", "Cocktail", "Tea Room"),
    "culture": ("Museum", "Art Gallery", "Theater", "Historic", "Monument", "Memorial",
                "Performing Arts", "Library", "Castle", "Church", "Cathedral", "Opera"),
    "outdoor": ("Park", "Garden", "Plaza", "Beach", "Scenic Lookout", "Trail", "Forest",
                "Nature Preserve", "Botanical", "Harbor", "Pedestrian"),
    "night": ("Night Club", "Music Venue", "Concert Hall", "Jazz", "Rock Club"),
    "shopping": ("Retail", "Market", "Bookstore", "Boutique", "Shop", "Store"),
}

# Ordre = priorité : le premier qui répond donne le type affiché à l'utilisateur.
TYPES = [
    ("nightlife", ("Night Club", "Music Venue", "Concert Hall")),
    ("museum", ("Museum", "Art Gallery", "Theater", "Performing Arts", "Historic", "Monument")),
    ("cafe", ("Café", "Cafe", "Coffee", "Tea Room")),
    ("bar", ("Bar", "Pub", "Brewery", "Wine", "Cocktail")),
    ("restaurant", ("Restaurant", "Bistro", "Pizzeria", "Diner", "Steakhouse", "Creperie", "Bakery")),
    ("viewpoint", ("Scenic Lookout", "Plaza", "Monument")),
    ("park", ("Park", "Garden", "Beach", "Trail", "Forest", "Botanical", "Nature Preserve")),
    ("hotel", ("Hotel", "Lodging", "Bed and Breakfast")),
    ("shopping", ("Retail", "Market", "Bookstore", "Store", "Shop")),
]

LOT = 2000


def reglage(cle):
    with open(".claude/settings.local.json") as f:
        env = json.load(f).get("env", {})
    return env.get(cle) or os.environ.get(cle)


def sql(requete):
    ref, jeton = reglage("SUPABASE_PROJECT_REF"), reglage("SUPABASE_ACCESS_TOKEN")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        method="POST",
        data=json.dumps({"query": requete}).encode(),
        headers={
            "Authorization": f"Bearer {jeton}",
            "Content-Type": "application/json",
            # Indispensable : sans User-Agent explicite, le pare-feu répond 403.
            "User-Agent": "vibetrip-ingest/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def clause(motifs, col="x"):
    return " OR ".join(f"{col} LIKE '%{m}%'" for m in motifs)


def classer(labels):
    blob = " | ".join(labels or [])
    themes = [t for t, mots in THEMES.items() if any(m in blob for m in mots)]
    ptype = next((t for t, mots in TYPES if any(m in blob for m in mots)), "other")
    return themes, ptype


def lit(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def arr(vals):
    return "'{}'" if not vals else "ARRAY[" + ",".join(lit(v) for v in vals) + "]::text[]"


def source_sql(source):
    """La requête d'extraction, selon l'origine des données."""
    if source == "miroir":
        fichiers = ",".join(f"'{MIROIR}{i}.parquet'" for i in FICHIERS_FRANCE)
        return f"read_parquet([{fichiers}])"
    # Catalogue Foursquare : le nom de table sera à ajuster quand le jeu sera rattaché au
    # compte — les espaces de noms sont vides tant qu'il ne l'est pas.
    return "places.datasets.places"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=("miroir", "catalogue"), default="miroir")
    ap.add_argument("--sec", action="store_true", help="n'écrit pas en base")
    args = ap.parse_args()

    try:
        import duckdb
    except ImportError:
        print("duckdb manquant : pip install duckdb", file=sys.stderr)
        sys.exit(1)

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET preserve_insertion_order=false;")

    if args.source == "catalogue":
        tok = reglage("FOURSQUARE_TOKEN")
        if not tok:
            print("FOURSQUARE_TOKEN absent.", file=sys.stderr)
            sys.exit(1)
        con.execute("INSTALL iceberg; LOAD iceberg;")
        con.execute(f"CREATE SECRET fsq (TYPE ICEBERG, TOKEN '{tok}');")
        con.execute(f"ATTACH 'places' AS places (TYPE iceberg, SECRET fsq, ENDPOINT '{CATALOGUE}');")

    perm = " OR ".join(f"x LIKE '%{m}%'" for m in PERMANENT)
    t0 = time.time()
    print(f"extraction ({args.source})…", flush=True)
    con.execute(f"""
      CREATE TABLE base AS
      SELECT fsq_place_id, name, latitude, longitude, address, locality, postcode,
             date_refreshed, fsq_category_labels, tel, website,
             list_contains(list_transform(fsq_category_labels, x -> {perm}), true) AS permanent
      FROM {source_sql(args.source)}
      WHERE country = 'FR'
        AND latitude BETWEEN 41.3 AND 51.2 AND longitude BETWEEN -5.3 AND 9.7
        AND date_closed IS NULL
        AND list_contains(list_transform(fsq_category_labels, x -> {clause(GARDER)}), true)
        AND NOT list_contains(list_transform(fsq_category_labels, x -> {clause(EXCLURE)}), true)
    """)
    lignes = con.execute("SELECT * FROM base").fetchall()
    print(f"  {len(lignes)} lieux retenus en {time.time()-t0:.0f}s", flush=True)

    if args.sec:
        print("(à sec : rien n'est écrit)")
        return

    cols = ("fsq_id,name,location,address,locality,postcode,categories,themes,place_type,"
            "permanent,refreshed_at,tel,website")
    t0, envoyes = time.time(), 0
    for i in range(0, len(lignes), LOT):
        valeurs = []
        for r in lignes[i:i + LOT]:
            fsq, nom, lat, lng, addr, loc, cp, maj, cats, tel, web, perma = r
            if not nom or lat is None or lng is None:
                continue
            themes, ptype = classer(cats)
            valeurs.append(
                f"({lit(fsq)},{lit(nom)},ST_SetSRID(ST_MakePoint({lng},{lat}),4326)::geography,"
                f"{lit(addr)},{lit(loc)},{lit(cp)},{arr(cats)},{arr(themes)},{lit(ptype)},"
                f"{'true' if perma else 'false'},{lit(maj)},{lit(tel)},{lit(web)})"
            )
        if not valeurs:
            continue
        # `do update` et non `do nothing` : un rechargement doit rafraîchir les fiches
        # existantes, sans toucher aux colonnes google_* ni à proposed_count, qui nous
        # appartiennent et ne viennent pas du référentiel.
        sql(f"""insert into places ({cols}) values {','.join(valeurs)}
                on conflict (fsq_id) do update set
                  name = excluded.name, location = excluded.location, address = excluded.address,
                  locality = excluded.locality, postcode = excluded.postcode,
                  categories = excluded.categories, themes = excluded.themes,
                  place_type = excluded.place_type, refreshed_at = excluded.refreshed_at,
                  tel = excluded.tel, website = excluded.website;""")
        envoyes += len(valeurs)
        if (i // LOT) % 20 == 0:
            print(f"  {envoyes}/{len(lignes)} — {time.time()-t0:.0f}s", flush=True)

    print(f"terminé en {time.time()-t0:.0f}s")
    print(sql("select count(*) as n from places"))


if __name__ == "__main__":
    main()
