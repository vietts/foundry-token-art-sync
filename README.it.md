# arte-token

Modulo Foundry (v13/v14, qualsiasi sistema) che tiene il **token allineato al
ritratto** dell'attore, senza mai ribaltare una scelta fatta apposta.

Va acceso **in ogni mondo** in cui lo vuoi (Manage Modules).

## La regola

Il caso di tutti i giorni e' la **modifica**, non la creazione: un attore non si
crea con la sua arte gia' addosso — nasce col token di default e il ritratto
glielo dai dopo. Quindi:

- **`preUpdateActor`** — dai un ritratto a un attore e il token lo segue, ma
  **solo se stava gia' seguendo**: se prima era uguale al vecchio ritratto, o se
  era ancora un segnaposto. Un token differenziato di proposito resta dov'e'.
- **`preCreateActor`** — serve agli import da compendio, che arrivano col
  ritratto gia' nel payload. Riempie solo i token vuoti o al segnaposto.

Entrambi scrivono *prima* della scrittura vera: parte un update solo, e il token
non compare sbagliato per poi cambiare sotto gli occhi.

## Cosa non tocca, mai

- **I ritratti segnaposto.** La lista esatta (`mystery-man`, `cowled`, il
  `dragon-head` di daggerheart) piu' tutto quello che sta sotto `icons/svg/`,
  che e' dove i sistemi tengono i loro default. Il drago e' il caso che brucia:
  e' l'`img` di **tutti** e 264 gli avversari del compendio daggerheart 2.8.2,
  propagarlo cancellerebbe l'arte buona in silenzio.
- **La convenzione dnd5e `tokens/thumbs/`.** Li' il ritratto e' la miniatura
  dello stesso token: sul Bone Devil sono 137 KB contro 698 KB, allinearli
  abbassa la risoluzione.
- **I token wildcard** (`randomImg`).
- **I token gia' scelti.** Alla nascita, un import che porta con se' il suo
  token; alla modifica, un token che non seguiva il ritratto.

## Impostazioni

*Configura impostazioni → Impostazioni modulo*

- **Allinea il token al ritratto** — interruttore generale (default: acceso)
- **Solo i PNG** — lascia fuori i personaggi giocanti (default: spento)
- **Ritratti segnaposto**, **Cartelle di segnaposto**, **Cartella delle miniature** — le
  regole di "cosa non e' arte vera", una voce per riga. I default sono quelli storici
  (icone di serie di Foundry, il drago di Daggerheart, la convenzione `/thumbs/` di dnd5e):
  un altro sistema aggiunge i propri senza toccare il codice.
- **Allinea i token esistenti…** — bottone: anteprima e poi scrittura in blocco per gli
  attori che esistono gia'. Riempie solo i token vuoti o al segnaposto, mai arte vera.
  Da macro: `game.modules.get("arte-token").api.allinea({ dryRun: true })` restituisce il piano
  senza scrivere.

## Anello dinamico

Se il token ha l'anello acceso e un soggetto proprio (`ring.subject.texture`), quel soggetto
**sovrascrive** l'arte del token: allinearne solo `texture.src` non si vedrebbe. Il soggetto
segue con la stessa regola del token — solo se era un segnaposto o uguale al vecchio ritratto.
Un soggetto scelto apposta resta dov'e'.

## Limiti noti

- Cambia il **token prototipo** dell'attore. I token gia' piazzati sulle scene non cambiano:
  e' il comportamento normale di Foundry per gli attori non collegati.
- Il bottone "Allinea i token esistenti" lavora sugli attori del **mondo**, non su quelli
  dentro i compendi.

## Struttura

- `module/lib/arte-token.mjs` — solo la decisione: funzioni pure, nessun globale
  di Foundry, tutto testato. Ogni rifiuto porta un `motivo` leggibile, che e' cio'
  che rende diagnosticabile un'automazione che gira da sola.
- `module/arte-token.mjs` — i due hook e le impostazioni
- `module/apps/allinea.mjs` — anteprima e scrittura in blocco (usa `DialogV2`)
- `test/` — `npm test`, test runner di Node, nessuna dipendenza

## Deploy

    ./deploy.sh

Il container Foundry gira come uid 1000: `deploy.sh` fa il `chown` da se'.
Alla prima installazione serve `docker restart foundry` perche' il modulo
compaia in Manage Modules.
