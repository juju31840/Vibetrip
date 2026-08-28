#!/bin/bash
# Routine mensuelle du socle de lieux.
#
# Ce qu'elle peut faire seule : vérifier l'accès au catalogue, prévenir avant que le jeton
# n'expire, et recharger dès que le jeu de données est disponible.
#
# Ce qu'elle ne peut PAS faire : régénérer le jeton. Le portail Foursquare n'en délivre que
# d'un mois au maximum, et leur création passe par une page authentifiée. C'est la raison d'être
# de l'alerte : sans elle, la routine échouerait silencieusement au bout de trente jours, et le
# socle vieillirait sans que personne ne le remarque.
#
# Elle tourne en local et non sur un serveur, délibérément : le rechargement lit 2,4 Go de
# Parquet et écrit 575 000 lignes — quarante minutes, hors de portée d'une fonction serverless.
# Une tâche de maintenance de données peut glisser de quelques jours ; ce n'est pas un service.
#
# Installation : bash scripts/routine-places.sh --installer
# Journal : ~/Library/Logs/vibetrip-places.log

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"

JOURNAL="$HOME/Library/Logs/vibetrip-places.log"
PLIST="$HOME/Library/LaunchAgents/com.vibetrip.places.plist"

installer() {
  mkdir -p "$(dirname "$PLIST")" "$(dirname "$JOURNAL")"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.vibetrip.places</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(pwd)/scripts/routine-places.sh</string>
  </array>
  <!-- Le 1er de chaque mois à 9 h. launchd rattrape le rendez-vous manqué si la machine
       était éteinte, ce qu'un cron classique ne fait pas. -->
  <key>StartCalendarInterval</key>
  <dict><key>Day</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$JOURNAL</string>
  <key>StandardErrorPath</key><string>$JOURNAL</string>
  <key>WorkingDirectory</key><string>$(pwd)</string>
</dict>
</plist>
PLISTEOF
  launchctl unload "$PLIST" 2>/dev/null
  launchctl load "$PLIST" && echo "Routine installée — 1er de chaque mois à 9 h."
  echo "  journal    : $JOURNAL"
  echo "  désactiver : launchctl unload $PLIST"
  exit 0
}

[ "${1:-}" = "--installer" ] && installer

echo "──────────────────────────────────────────────"
echo "$(date '+%d/%m/%Y %H:%M') — routine du socle de lieux"

# 1. L'accès et l'échéance du jeton.
SORTIE=$(npm run --silent refresh:places 2>&1)
echo "$SORTIE"

JOURS=$(echo "$SORTIE" | grep -oE '\(([0-9-]+) jours\)' | grep -oE '[0-9-]+' | head -1)
if [ -n "$JOURS" ] && [ "$JOURS" -lt 8 ]; then
  echo "⚠ JETON FOURSQUARE À RENOUVELER — il expire dans $JOURS jour(s)."
  echo "  En régénérer un sur places.foursquare.com, puis le remplacer dans"
  echo "  .claude/settings.local.json sous FOURSQUARE_TOKEN."
  # Une notification visible : un avertissement dans un journal que personne n'ouvre
  # n'avertit personne.
  osascript -e 'display notification "Jeton Foursquare à renouveler" with title "VibeTrip"' 2>/dev/null
fi

# 2. Le rechargement, si et seulement si le catalogue expose enfin le jeu de données.
if echo "$SORTIE" | grep -q "Aucune table exposée"; then
  echo "→ Rechargement impossible : le jeu OS Places n'est pas rattaché au compte."
  echo "  Rien d'alarmant — le socle en base vient du miroir public, dont la dernière"
  echo "  version (février 2025) est déjà celle qui est chargée."
else
  echo "→ Catalogue accessible : rechargement."
  python3 scripts/ingest-places.py --source catalogue
fi

# 3. La santé de la base, dans tous les cas.
npm run --silent check:places 2>/dev/null || true
echo "fin — $(date '+%H:%M')"
