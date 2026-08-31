import * as arte from "./lib/arte-token.mjs";

const MODULE_ID = arte.MODULE_ID;

const attivo = () => game.settings.get(MODULE_ID, "attivo");
const opzioni = () => ({ onlyNpc: game.settings.get(MODULE_ID, "soloPng") });

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
  actor.updateSource(arte.tokenArtUpdate(esito.src));
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
  changes[arte.CAMPO_TOKEN] = esito.src;
  console.log(`${MODULE_ID} | ${actor.name}: token segue il ritratto → ${esito.src}`);
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = arte;
  console.log(`${MODULE_ID} | attivo: ${attivo()}`);
});
