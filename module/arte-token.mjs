import * as arte from "./lib/arte-token.mjs";
import { AllineaMenu, allinea, leggiOpzioni, pianoMondo } from "./apps/allinea.mjs";

const MODULE_ID = arte.MODULE_ID;

const attivo = () => game.settings.get(MODULE_ID, "attivo");
const opzioni = leggiOpzioni;

/** Un elenco "una voce per riga": un campo di testo a riga singola non permetterebbe di scriverlo. */
class ElencoField extends foundry.data.fields.StringField {
  _toInput(config) {
    config.elementType = "textarea";
    config.rows ??= 4;
    return super._toInput(config);
  }
}
const elenco = iniziale => new ElencoField({ required: true, blank: true, initial: iniziale });

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "attivo", {
    name: "ARTETOKEN.settings.attivo.name",
    hint: "ARTETOKEN.settings.attivo.hint",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "soloPng", {
    name: "ARTETOKEN.settings.soloPng.name",
    hint: "ARTETOKEN.settings.soloPng.hint",
    scope: "world", config: true, type: Boolean, default: false
  });

  // Le regole sono testo, una voce per riga: si leggono a ogni evento, quindi vanno a effetto subito.
  game.settings.register(MODULE_ID, "segnaposto", {
    name: "ARTETOKEN.settings.segnaposto.name",
    hint: "ARTETOKEN.settings.segnaposto.hint",
    scope: "world", config: true, type: elenco(arte.REGOLE_DEFAULT.segnaposto.join("\n"))
  });

  game.settings.register(MODULE_ID, "prefissi", {
    name: "ARTETOKEN.settings.prefissi.name",
    hint: "ARTETOKEN.settings.prefissi.hint",
    scope: "world", config: true, type: elenco(arte.REGOLE_DEFAULT.prefissi.join("\n"))
  });

  game.settings.register(MODULE_ID, "cartellaMiniature", {
    name: "ARTETOKEN.settings.cartellaMiniature.name",
    hint: "ARTETOKEN.settings.cartellaMiniature.hint",
    scope: "world", config: true, type: String, default: arte.REGOLE_DEFAULT.cartellaMiniature
  });

  game.settings.registerMenu(MODULE_ID, "allinea", {
    name: "ARTETOKEN.menu.name",
    label: "ARTETOKEN.menu.label",
    hint: "ARTETOKEN.menu.hint",
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
