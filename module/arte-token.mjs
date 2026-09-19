import * as arte from "./lib/arte-token.mjs";
import { AllineaMenu, allinea, leggiOpzioni, pianoMondo } from "./apps/allinea.mjs";

const MODULE_ID = arte.MODULE_ID;

const attivo = () => game.settings.get(MODULE_ID, "attivo");
const opzioni = leggiOpzioni;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "attivo", {
    name: "Allinea il token al ritratto",
    hint: "Quando dai un ritratto a un attore, il token lo segue — ma solo se stava gia' seguendo, "
        + "o se era ancora al segnaposto. Un token scelto apposta resta dov'e'.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "soloPng", {
    name: "Solo i PNG",
    hint: "Lascia fuori i personaggi giocanti, anche quando il loro token seguiva il ritratto.",
    scope: "world", config: true, type: Boolean, default: false
  });

  // Le regole sono testo, una voce per riga: si leggono a ogni evento, quindi vanno a effetto subito.
  game.settings.register(MODULE_ID, "segnaposto", {
    name: "Ritratti segnaposto",
    hint: "Un'immagine per riga. Non vengono mai copiate sul token, e un token che le ha ancora e' considerato non scelto.",
    scope: "world", config: true, type: String, default: arte.REGOLE_DEFAULT.segnaposto.join("\n")
  });

  game.settings.register(MODULE_ID, "prefissi", {
    name: "Cartelle di segnaposto",
    hint: "Un prefisso per riga: tutto cio' che sta sotto e' trattato come segnaposto (default: le icone di serie di Foundry).",
    scope: "world", config: true, type: String, default: arte.REGOLE_DEFAULT.prefissi.join("\n")
  });

  game.settings.register(MODULE_ID, "cartellaMiniature", {
    name: "Cartella delle miniature",
    hint: "Se il ritratto sta in <cartella>/x e il token in /x, sono la stessa arte a due risoluzioni e non si allineano (convenzione dnd5e). Vuoto = disattivato.",
    scope: "world", config: true, type: String, default: arte.REGOLE_DEFAULT.cartellaMiniature
  });

  game.settings.registerMenu(MODULE_ID, "allinea", {
    name: "Attori esistenti",
    label: "Allinea i token esistenti…",
    hint: "Mostra un'anteprima e allinea solo i token vuoti o al segnaposto. Non tocca mai un token che ha gia' arte sua.",
    icon: "fa-solid fa-user-check",
    type: AllineaMenu,
    restricted: true
  });
});

/*
 * Creazione. Serve soprattutto agli import da compendio, che arrivano col ritratto gia' nel
 * payload: un attore creato a mano nasce col token di default e il ritratto glielo metti dopo,
 * quindi per quello lavora l'hook sotto. `soloSeSegnaposto` perche' un import che porta con
 * se' il suo token e' una decisione di chi importa, non un errore da correggere.
 */
Hooks.on("preCreateActor", actor => {
  if (!attivo()) return;
  const esito = arte.decideTokenArt(actor, { ...opzioni(), soloSeSegnaposto: true });
  if (!esito.sync) return;
  actor.updateSource(arte.tokenArtUpdate(esito.src, esito));
  console.log(`${MODULE_ID} | ${actor.name}: token allineato alla nascita → ${esito.src}`);
});

/*
 * Modifica del ritratto: il caso di tutti i giorni. Scriviamo dentro `changes`, quindi parte
 * un update solo — il token non compare sbagliato per poi cambiare sotto gli occhi.
 */
Hooks.on("preUpdateActor", (actor, changes) => {
  if (!attivo()) return;
  const esito = arte.decideTokenArtUpdate(actor, changes, opzioni());
  if (!esito.sync) return;
  Object.assign(changes, arte.tokenArtUpdate(esito.src, esito));
  console.log(`${MODULE_ID} | ${actor.name}: token segue il ritratto → ${esito.src}`);
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { ...arte, allinea, pianoMondo };
  console.log(`${MODULE_ID} | attivo: ${attivo()}`);
});
