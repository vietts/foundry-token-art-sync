/*
 * Token e ritratto che non coincidono mai: l'attore nasce col ritratto giusto e il token
 * al segnaposto, e qualcuno deve accorgersene a mano ogni volta.
 *
 * Qui c'e' solo la decisione, niente scritture e niente globali di Foundry: riceve la forma
 * minima di un attore ({ img, type, prototypeToken }) e dice se il token va allineato e perche'
 * no, quando no. Il "perche' no" non e' cosmetico — e' quello che rende diagnosticabile
 * un'automazione che gira da sola su ogni attore.
 */

export const MODULE_ID = "arte-token";

/**
 * Ritratti che non devono mai finire su un token. Il drago e' il caso che brucia:
 * in daggerheart 2.8.2 tutti e 264 gli avversari del compendio hanno `img` = dragon-head,
 * quindi una sincronizzazione cieca ripianta il segnaposto sopra l'arte buona, in silenzio.
 */
export const SEGNAPOSTO = Object.freeze([
  "icons/svg/mystery-man.svg",   // CONST.DEFAULT_TOKEN
  "icons/svg/cowled.svg",
  "systems/daggerheart/assets/icons/documents/actors/dragon-head.svg"
]);

/** Le icone di serie di Foundry: nessun sistema le usa come arte vera, tutti come default. */
export const CARTELLA_ICONE = "icons/svg/";

/**
 * Un ritratto vuoto o segnaposto non e' arte: non va propagato, e un token che ce l'ha
 * e' un token che nessuno ha ancora scelto.
 *
 * Il prefisso `icons/svg/` conta oltre alla lista esatta perche' il caso normale e' proprio
 * quello: un attore non si crea con la sua arte gia' addosso — nasce col default e il
 * ritratto glielo metti dopo. Quale sia quel default dipende dal sistema, e non possiamo
 * elencarli tutti; sono tutti li' sotto.
 */
export function isSegnaposto(img) {
  return !img || SEGNAPOSTO.includes(img) || img.startsWith(CARTELLA_ICONE);
}

/**
 * dnd5e usa `tokens/thumbs/<x>.webp` come ritratto e `tokens/<x>.webp` come token:
 * stessa arte, due risoluzioni. Sul Bone Devil sono 137 KB contro 698 KB — allinearli
 * significa mettere la miniatura sul token, cioe' peggiorare quello che c'e'.
 */
export function isMiniatura(img, src) {
  return img.includes("/thumbs/") && img.replace("/thumbs/", "/") === src;
}

const salta = motivo => ({ sync: false, motivo });

/** Il changeset da scrivere. Un posto solo per il nome del campo. */
export const CAMPO_TOKEN = "prototypeToken.texture.src";
export function tokenArtUpdate(src) {
  return { [CAMPO_TOKEN]: src };
}

/** Legge il token dal payload di un update, che puo' arrivare piatto o annidato. */
export function tokenSrcNelPayload(changes) {
  if (!changes) return undefined;
  if (CAMPO_TOKEN in changes) return changes[CAMPO_TOKEN];
  return changes?.prototypeToken?.texture?.src;
}

/**
 * Alla CREAZIONE dell'attore.
 *
 * @param actor  forma minima: { img, type, prototypeToken: { randomImg, texture: { src } } }
 * @param opts.onlyNpc          true = non toccare i PG
 * @param opts.soloSeSegnaposto true = riempi solo i token vuoti o al segnaposto, non sovrascrivere
 *                              mai arte vera. Un import che porta con se' il suo token e' una
 *                              decisione di chi importa, non un errore da correggere.
 * @returns {{ sync: true, src: string } | { sync: false, motivo: string }}
 */
export function decideTokenArt(actor, { onlyNpc = false, soloSeSegnaposto = false } = {}) {
  const img = actor?.img ?? "";
  const token = actor?.prototypeToken ?? {};
  const src = token?.texture?.src ?? "";

  if (isSegnaposto(img)) return salta("il ritratto e' vuoto o segnaposto");
  if (onlyNpc && actor?.type !== "npc") return salta("non e' un PNG");
  if (token?.randomImg) return salta("token wildcard");
  if (src === img) return salta("gia' allineati");
  if (isMiniatura(img, src)) return salta("il ritratto e' la miniatura dello stesso token");
  if (soloSeSegnaposto && !isSegnaposto(src)) return salta("il token ha gia' arte sua");

  return { sync: true, src: img };
}

/**
 * Alla MODIFICA del ritratto di un attore che esiste gia'.
 *
 * La regola e' "segui solo se stavi gia' seguendo": il token va dietro al ritratto nuovo
 * soltanto se prima era uguale al ritratto vecchio, oppure era un segnaposto. Un token
 * differenziato di proposito (Willow: ritratto gildan, token Elf_Feral_Warlock) non e' un
 * disallineamento da riparare — e' una scelta, e un'automazione non la ribalta.
 *
 * @param actor    l'attore com'e' ADESSO (prima dell'update)
 * @param changes  il payload dell'update
 */
export function decideTokenArtUpdate(actor, changes, { onlyNpc = false } = {}) {
  const imgNuova = changes?.img;
  if (imgNuova === undefined) return salta("l'update non tocca il ritratto");
  if (tokenSrcNelPayload(changes) !== undefined) return salta("l'update imposta gia' il token per conto suo");

  const imgVecchia = actor?.img ?? "";
  const src = actor?.prototypeToken?.texture?.src ?? "";
  const seguiva = isSegnaposto(src) || src === imgVecchia;
  if (!seguiva) return salta("il token non seguiva il ritratto: e' una scelta, non la tocchiamo");

  return decideTokenArt(
    { ...actor, img: imgNuova, prototypeToken: actor?.prototypeToken },
    { onlyNpc }
  );
}
