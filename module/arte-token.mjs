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
 *
 * Qui si decide anche per i token gia' in scena, ma si scrive dopo (updateActor): servono il
 * ritratto e il prototipo di PRIMA, e Foundry passa a pre e post update due copie diverse
 * delle opzioni (actor-delta.mjs, v14), quindi non ci si puo' appoggiare li'. Li tiene questa
 * mappa, per uuid, solo sul client che fa la modifica.
 */
const primaDellUpdate = new Map();

Hooks.on("preUpdateActor", (actor, changes) => {
  if (!attivo()) return;
  if (changes?.img === undefined) return;

  /* Un token non collegato modificato dalla sua scheda: l'attore e' sintetico e il suo
     prototipo non esiste davvero. Conta solo quel token. */
  if (actor.isToken) {
    if (opzioni().onlyNpc && actor.type === "character") return;
    primaDellUpdate.set(actor.uuid, { imgVecchia: actor.img, srcVecchio: null });
    console.log(`${MODULE_ID} | ${actor.name} (token non collegato): ritratto in modifica, controllo il token dopo il salvataggio`);
    return;
  }

  const esito = arte.decideTokenArtUpdate(actor, changes, opzioni());
  if (!esito.sync) {
    console.log(`${MODULE_ID} | ${actor.name}: prototipo lasciato com'e' — ${esito.motivo}`);
    return;
  }
  primaDellUpdate.set(actor.uuid, { imgVecchia: actor.img, srcVecchio: actor.prototypeToken.texture.src });
  Object.assign(changes, arte.tokenArtUpdate(esito.src, esito));
  console.log(`${MODULE_ID} | ${actor.name}: token segue il ritratto → ${esito.src}`);
});

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (userId !== game.user.id) return;
  let prima = primaDellUpdate.get(actor.uuid);
  primaDellUpdate.delete(actor.uuid);
  if (changed?.img === undefined) return;
  /* Per un token non collegato basta l'arte dell'attore del mondo per decidere: se il "prima"
     mancasse, il confronto con quella regge da solo. Per un attore del mondo no: senza il
     prima non si sa se il prototipo seguiva. */
  if (!prima) {
    if (!actor.isToken || !attivo()) return;
    if (opzioni().onlyNpc && actor.type === "character") return;
    prima = { imgVecchia: null, srcVecchio: null };
  }

  const regole = opzioni().regole;
  /* L'arte dell'attore del mondo, per i token non collegati: vedi tokenInScenaDaAllineare. */
  const base = actor.isToken ? actor.token?.baseActor : null;
  const origine = base ? [base.img, base.prototypeToken?.texture?.src] : [];
  const token = actor.isToken
    ? [actor.token]
    : game.scenes.contents.flatMap(s => s.tokens.filter(t => t.actorId === actor.id));

  /* Un giocatore che cambia il ritratto del suo PG non puo' scrivere token altrui: si toccano
     solo quelli di cui e' proprietario. Il GM li vede tutti. */
  const perScena = new Map();
  for (const t of token) {
    if (!t?.isOwner) continue;
    const changes = arte.tokenInScenaDaAllineare(t, { ...prima, imgNuova: actor.img, origine, regole });
    if (!changes) {
      console.log(`${MODULE_ID} | ${actor.name}: token "${t.name}" lasciato com'e' — ha un'arte sua (${t.texture?.src})`);
      continue;
    }
    if (!perScena.has(t.parent)) perScena.set(t.parent, []);
    perScena.get(t.parent).push({ _id: t.id, ...changes });
  }

  for (const [scena, updates] of perScena) {
    try {
      await scena.updateEmbeddedDocuments("Token", updates);
      console.log(`${MODULE_ID} | ${actor.name}: ${updates.length} token in "${scena.name}" seguono il ritratto`);
    } catch (e) {
      console.error(`${MODULE_ID} | ${actor.name}: token in "${scena.name}" non aggiornati`, e);
    }
  }
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { ...arte, allinea, pianoMondo };
  console.log(`${MODULE_ID} | attivo: ${attivo()}`);
});
