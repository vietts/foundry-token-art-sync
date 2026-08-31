#!/usr/bin/env bash
# Copia il modulo sul VPS e sistema i permessi. Il container gira come uid 1000.
set -euo pipefail

SERVER="utente@host"
DEST="/opt/foundry/data/Data/modules/arte-token"
HERE="$(cd "$(dirname "$0")" && pwd)"

rsync -av --delete -e ssh "$HERE/module/" "$SERVER:$DEST/"
ssh "$SERVER" "chown -R 1000:1000 $DEST && ls -la $DEST"

echo
echo "Copiato. Alla prima installazione serve un riavvio perche' compaia in Manage Modules:"
echo "  ssh $SERVER 'docker restart foundry'"
echo "Poi va acceso in OGNI mondo in cui lo vuoi (Manage Modules)."
