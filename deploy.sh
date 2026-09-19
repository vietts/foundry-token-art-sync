#!/usr/bin/env bash
# Copia il modulo su un server Foundry e sistema i permessi. Il container gira come uid 1000.
#
# Il server non sta nel repo: questo file e' pubblico, e l'indirizzo di un Foundry vivo piu'
# l'utente con cui ci si entra sono meta' del lavoro di chi cerca bersagli. Nessun default:
# senza le tre variabili lo script si ferma.
#
#   FOUNDRY_HOST=utente@host \
#   FOUNDRY_MODULES_DIR=/percorso/a/Data/modules \
#   FOUNDRY_CONTAINER=nome-container \
#   ./deploy.sh
set -euo pipefail

SERVER="${FOUNDRY_HOST:?serve FOUNDRY_HOST (utente@host del server Foundry)}"
MODULES_DIR="${FOUNDRY_MODULES_DIR:?serve FOUNDRY_MODULES_DIR (la cartella modules di Data)}"
CONTAINER="${FOUNDRY_CONTAINER:?serve FOUNDRY_CONTAINER (il nome del container Foundry)}"

DEST="$MODULES_DIR/arte-token"
HERE="$(cd "$(dirname "$0")" && pwd)"

rsync -av --delete -e ssh "$HERE/module/" "$SERVER:$DEST/"
ssh "$SERVER" "chown -R 1000:1000 $DEST && ls -la $DEST"

echo
echo "Copiato. Un file cambiato si prende ricaricando la pagina; un modulo nuovo, o un cambio a"
echo "esmodules/languages nel manifest, vuole un riavvio del server. Non usare 'docker restart':"
echo "il lock di Foundry non si rilascia da solo, va rimosso fra stop e start:"
echo "  ssh $SERVER \\"
echo "    'docker stop $CONTAINER; rmdir <Data>/Config/options.json.lock 2>/dev/null; docker start $CONTAINER'"
