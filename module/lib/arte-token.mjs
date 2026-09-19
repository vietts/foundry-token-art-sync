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
 * Le regole in un posto solo. I default sono quelli storici (i dati di chi ha scritto il modulo);
 * il modulo li rende modificabili dalle impostazioni, cosi' un altro mondo o un altro sistema
 * aggiunge i propri segnaposto senza toccare il codice.
 */
export const REGOLE_DEFAULT = Object.freeze({
  segnaposto: Object.freeze([...SEGNAPOSTO]),
  prefissi: Object.freeze([CARTELLA_ICONE]),
  cartellaMiniature: "/thumbs/"
});

/** "una voce per riga" -> array pulito. Serve alle impostazioni, che sono testo. */
export function parseElenco(testo) {
  return String(testo ?? "").split(/\r?\n/).map(r => r.trim()).filter(Boolean);
}

/** Completa con i default cio' che manca: chi chiama non deve conoscere tutti i campi. */
export function normalizzaRegole(regole = {}) {
  return {
    segnaposto: regole.segnaposto ?? [...REGOLE_DEFAULT.segnaposto],
    prefissi: regole.prefissi ?? [...REGOLE_DEFAULT.prefissi],
    cartellaMiniature: regole.cartellaMiniature ?? REGOLE_DEFAULT.cartellaMiniature
  };
}

/**
 * Un ritratto vuoto o segnaposto non e' arte: non va propagato, e un token che ce l'ha
 * e' un token che nessuno ha ancora scelto.
 *
 * Il prefisso `icons/svg/` conta oltre alla lista esatta perche' il caso normale e' proprio
 * quello: un attore non si crea con la sua arte gia' addosso — nasce col default e il
 * ritratto glielo metti dopo. Quale sia quel default dipende dal sistema, e non possiamo
 * elencarli tutti; sono tutti li' sotto.
 */
export function isSegnaposto(img, regole = REGOLE_DEFAULT) {
  if (!img) return true;
  const r = normalizzaRegole(regole);
  return r.segnaposto.includes(img) || r.prefissi.some(p => p && img.startsWith(p));
}

/**
 * dnd5e usa `tokens/thumbs/<x>.webp` come ritratto e `tokens/<x>.webp` come token:
 * stessa arte, due risoluzioni. Sul Bone Devil sono 137 KB contro 698 KB — allinearli
 * significa mettere la miniatura sul token, cioe' peggiorare quello che c'e'.
 */
export function isMiniatura(img, src, regole = REGOLE_DEFAULT) {
  const cartella = normalizzaRegole(regole).cartellaMiniature;
  return Boolean(cartella) && img.includes(cartella) && img.replace(cartella, "/") === src;
}

const salta = motivo => ({ sync: false, motivo });

/** Il changeset da scrivere. Un posto solo per il nome dei campi. */
export const CAMPO_TOKEN = "prototypeToken.texture.src";
export const CAMPO_ANELLO = "prototypeToken.ring.subject.texture";

/** `esito` e' quello di decideTokenArt*: se porta `anello`, va scritto anche il soggetto dell'anello. */
export function tokenArtUpdate(src, esito = {}) {
  const changes = { [CAMPO_TOKEN]: src };
  if (esito.anello) changes[CAMPO_ANELLO] = src;
  return changes;
}

/** Legge il token dal payload di un update, che puo' arrivare piatto o annidato. */
export function tokenSrcNelPayload(changes) {
  if (!changes) return undefined;
  if (CAMPO_TOKEN in changes) return changes[CAMPO_TOKEN];
  return changes?.prototypeToken?.texture?.src;
}

/** Idem per il soggetto dell'anello dinamico. */
export function anelloNelPayload(changes) {
  if (!changes) return undefined;
  if (CAMPO_ANELLO in changes) return changes[CAMPO_ANELLO];
  return changes?.prototypeToken?.ring?.subject?.texture;
}

/**
 * Con l'anello dinamico acceso, `ring.subject.texture` SOVRASCRIVE l'arte del token: se e' valorizzato,
 * cambiare solo `texture.src` non si vedrebbe. Il soggetto va dietro al ritratto con la stessa regola
 * del token — segue solo se stava gia' seguendo (segnaposto, o uguale al vecchio ritratto).
 * Vuoto = l'anello usa `texture.src`, non c'e' niente da fare.
 */
function anelloDaSeguire(token, imgVecchia, regole) {
  const soggetto = token?.ring?.subject?.texture;
  if (!token?.ring?.enabled || !soggetto) return false;
  return isSegnaposto(soggetto, regole) || soggetto === imgVecchia;
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
export function decideTokenArt(actor, { onlyNpc = false, soloSeSegnaposto = false, regole = REGOLE_DEFAULT, imgVecchia } = {}) {
  const img = actor?.img ?? "";
  const token = actor?.prototypeToken ?? {};
  const src = token?.texture?.src ?? "";

  if (isSegnaposto(img, regole)) return salta("il ritratto e' vuoto o segnaposto");
  if (onlyNpc && actor?.type !== "npc") return salta("non e' un PNG");
  if (token?.randomImg) return salta("token wildcard");
  if (src === img) return salta("gia' allineati");
  if (isMiniatura(img, src, regole)) return salta("il ritratto e' la miniatura dello stesso token");
  if (soloSeSegnaposto && !isSegnaposto(src, regole)) return salta("il token ha gia' arte sua");

  const esito = { sync: true, src: img };
  // Alla nascita non c'e' un "ritratto vecchio": il soggetto segue solo se e' un segnaposto.
  if (anelloDaSeguire(token, imgVecchia, regole)) esito.anello = true;
  return esito;
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
export function decideTokenArtUpdate(actor, changes, { onlyNpc = false, regole = REGOLE_DEFAULT } = {}) {
  const imgNuova = changes?.img;
  if (imgNuova === undefined) return salta("l'update non tocca il ritratto");
  if (tokenSrcNelPayload(changes) !== undefined) return salta("l'update imposta gia' il token per conto suo");
  if (anelloNelPayload(changes) !== undefined) return salta("l'update imposta gia' il soggetto dell'anello per conto suo");

  const imgVecchia = actor?.img ?? "";
  const src = actor?.prototypeToken?.texture?.src ?? "";
  const seguiva = isSegnaposto(src, regole) || src === imgVecchia;
  if (!seguiva) return salta("il token non seguiva il ritratto: e' una scelta, non la tocchiamo");

  return decideTokenArt(
    { ...actor, img: imgNuova, prototypeToken: actor?.prototypeToken },
    { onlyNpc, regole, imgVecchia }
  );
}

/**
 * Per gli attori che ESISTONO GIA': niente changeset, solo un piano leggibile — cosa si allinea,
 * cosa no e perche'. Non c'e' un "ritratto vecchio" da confrontare, quindi vale la regola della
 * nascita: si riempiono solo i token vuoti o al segnaposto, mai arte vera.
 *
 * @param attori  forma minima { id, name, img, type, prototypeToken }
 * @returns {{ daAllineare: {id,name,src,anello?}[], saltati: {id,name,motivo}[], riepilogo: Record<string,number> }}
 */
export function pianoAllineamento(attori, { onlyNpc = false, regole = REGOLE_DEFAULT } = {}) {
  const daAllineare = [];
  const saltati = [];
  const riepilogo = {};
  for (const a of attori ?? []) {
    if (!a) continue;
    const esito = decideTokenArt(a, { onlyNpc, regole, soloSeSegnaposto: true });
    const voce = { id: a.id, name: a.name };
    if (esito.sync) {
      daAllineare.push({ ...voce, src: esito.src, ...(esito.anello ? { anello: true } : {}) });
    } else {
      saltati.push({ ...voce, motivo: esito.motivo });
      riepilogo[esito.motivo] = (riepilogo[esito.motivo] ?? 0) + 1;
    }
  }
  return { daAllineare, saltati, riepilogo };
}
