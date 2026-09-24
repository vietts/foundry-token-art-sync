import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODULE_ID, SEGNAPOSTO, CAMPO_TOKEN,
  isSegnaposto, isMiniatura, tokenArtUpdate, tokenSrcNelPayload,
  decideTokenArt, decideTokenArtUpdate
} from "../module/lib/arte-token.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DRAGO = "systems/daggerheart/assets/icons/documents/actors/dragon-head.svg";
const DEFAULT = "icons/svg/mystery-man.svg";

const attore = (img, src, extra = {}) => ({
  img, type: "npc",
  prototypeToken: { texture: { src }, ...extra }
});

/* --- manifest --- */

test("l'id di module.json coincide con MODULE_ID", () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../module/module.json", import.meta.url)), "utf8"));
  assert.equal(manifest.id, MODULE_ID);
  assert.deepEqual(manifest.esmodules, ["arte-token.mjs"]);
});

/* --- riconoscimento dei segnaposto --- */

test("vuoto, lista esatta e icone di serie contano tutti come segnaposto", () => {
  assert.equal(isSegnaposto(""), true);
  for (const s of SEGNAPOSTO) assert.equal(isSegnaposto(s), true, s);
  assert.equal(isSegnaposto("icons/svg/target.svg"), true);   // default di un sistema qualsiasi
  assert.equal(isSegnaposto("assets/Token NPC/Czepeku/Lamia/Lamia.png"), false);
});

/* --- creazione --- */

test("import da compendio col ritratto nel payload: il token lo prende", () => {
  assert.deepEqual(
    decideTokenArt(attore("assets/Lamia.png", DEFAULT), { soloSeSegnaposto: true }),
    { sync: true, src: "assets/Lamia.png" }
  );
});

test("i 264 avversari daggerheart non muovono nulla: drago su drago", () => {
  assert.equal(decideTokenArt(attore(DRAGO, DRAGO), { soloSeSegnaposto: true }).sync, false);
});

test("alla nascita non si sovrascrive un token che arriva gia' scelto", () => {
  assert.equal(decideTokenArt(attore("assets/ritratto.png", "assets/token-scelto.png"), { soloSeSegnaposto: true }).sync, false);
});

/* --- modifica del ritratto: il caso di tutti i giorni --- */

test("attore creato a mano, ritratto messo dopo: il token segue", () => {
  // nasce col default, poi gli dai l'arte
  const nato = attore(DEFAULT, DEFAULT);
  const esito = decideTokenArtUpdate(nato, { img: "assets/Czepeku/Cavalry Knight.png" });
  assert.deepEqual(esito, { sync: true, src: "assets/Czepeku/Cavalry Knight.png" });
});

test("il token che seguiva il vecchio ritratto segue anche il nuovo", () => {
  const a = attore("assets/vecchia.png", "assets/vecchia.png");
  assert.equal(decideTokenArtUpdate(a, { img: "assets/nuova.png" }).sync, true);
});

test("un token differenziato apposta non viene ribaltato (il caso Willow)", () => {
  const willow = { img: "assets/gildan.webp", type: "character",
                   prototypeToken: { texture: { src: "assets/Elf_Feral_Warlock.png" } } };
  const esito = decideTokenArtUpdate(willow, { img: "assets/ritratto-nuovo.png" });
  assert.equal(esito.sync, false);
  assert.match(esito.motivo, /scelta/);
});

test("un update che non tocca il ritratto non fa niente", () => {
  const a = attore("assets/x.png", "assets/x.png");
  assert.equal(decideTokenArtUpdate(a, { name: "Nuovo nome" }).sync, false);
  assert.equal(decideTokenArtUpdate(a, {}).sync, false);
});

test("se l'update imposta gia' il token, comanda lui", () => {
  const a = attore(DEFAULT, DEFAULT);
  assert.equal(decideTokenArtUpdate(a, { img: "assets/x.png", [CAMPO_TOKEN]: "assets/scelto.png" }).sync, false);
  assert.equal(decideTokenArtUpdate(a, { img: "assets/x.png", prototypeToken: { texture: { src: "assets/scelto.png" } } }).sync, false);
  assert.equal(tokenSrcNelPayload({ [CAMPO_TOKEN]: "a" }), "a");
  assert.equal(tokenSrcNelPayload({ prototypeToken: { texture: { src: "b" } } }), "b");
  assert.equal(tokenSrcNelPayload({}), undefined);
});

test("non si propaga un ritratto rimesso a segnaposto", () => {
  const a = attore("assets/buona.png", "assets/buona.png");
  assert.equal(decideTokenArtUpdate(a, { img: DEFAULT }).sync, false);
});

/* --- i paracadute, in entrambe le direzioni --- */

test("non degrada il token dnd5e alla sua miniatura", () => {
  const bone = attore("systems/dnd5e/tokens/thumbs/fiend/BoneDevil.webp",
                      "systems/dnd5e/tokens/fiend/BoneDevil.webp");
  assert.match(decideTokenArt(bone).motivo, /miniatura/);
  assert.equal(isMiniatura("systems/dnd5e/tokens/thumbs/a.webp", "systems/dnd5e/tokens/a.webp"), true);
  assert.equal(isMiniatura("assets/a.webp", "assets/b.webp"), false);
});

test("la miniatura di un'ALTRA arte non conta come miniatura", () => {
  assert.equal(decideTokenArt(attore("systems/dnd5e/tokens/thumbs/fiend/BoneDevil.webp",
                                     "systems/dnd5e/tokens/fiend/Balor.webp")).sync, true);
});

test("non tocca i token wildcard, ne' alla nascita ne' alla modifica", () => {
  const w = attore("assets/x.png", "assets/x.png", { randomImg: true });
  assert.equal(decideTokenArt(w).sync, false);
  assert.equal(decideTokenArtUpdate(w, { img: "assets/y.png" }).sync, false);
});

test("soloPng lascia fuori i PG anche quando seguivano", () => {
  const pg = { img: "assets/a.png", type: "character", prototypeToken: { texture: { src: "assets/a.png" } } };
  assert.equal(decideTokenArtUpdate(pg, { img: "assets/b.png" }, { onlyNpc: true }).sync, false);
  assert.equal(decideTokenArtUpdate(pg, { img: "assets/b.png" }, { onlyNpc: false }).sync, true);
});

test("ogni rifiuto porta un motivo leggibile", () => {
  assert.ok(decideTokenArt(attore(DRAGO, DRAGO)).motivo.length > 0);
  assert.ok(decideTokenArtUpdate(attore("a", "a"), {}).motivo.length > 0);
});

test("il changeset nomina il campo una volta sola", () => {
  assert.deepEqual(tokenArtUpdate("assets/x.png"), { "prototypeToken.texture.src": "assets/x.png" });
});

test("un attore malformato non fa esplodere niente", () => {
  assert.equal(decideTokenArt(null).sync, false);
  assert.equal(decideTokenArt({}).sync, false);
  assert.equal(decideTokenArtUpdate(null, null).sync, false);
  assert.equal(decideTokenArtUpdate({}, { img: "assets/x.png" }).sync, true);
});

/* --- regole configurabili --- */

import {
  REGOLE_DEFAULT, parseElenco, normalizzaRegole, pianoAllineamento, CAMPO_ANELLO, tokenArtUpdate as upd
} from "../module/lib/arte-token.mjs";

test("le regole di default coincidono con il comportamento storico", () => {
  assert.deepEqual(REGOLE_DEFAULT.segnaposto, [...SEGNAPOSTO]);
  assert.deepEqual(REGOLE_DEFAULT.prefissi, ["icons/svg/"]);
  assert.equal(REGOLE_DEFAULT.cartellaMiniature, "/thumbs/");
});

test("parseElenco: una voce per riga, spazi e righe vuote ignorati", () => {
  assert.deepEqual(parseElenco("  a.svg \n\n b.svg\r\n"), ["a.svg", "b.svg"]);
  assert.deepEqual(parseElenco(""), []);
  assert.deepEqual(parseElenco(undefined), []);
});

test("normalizzaRegole completa i campi mancanti con i default", () => {
  assert.deepEqual(normalizzaRegole({}), REGOLE_DEFAULT);
  assert.deepEqual(normalizzaRegole({ segnaposto: ["x.svg"] }).prefissi, ["icons/svg/"]);
});

test("un segnaposto aggiunto dall'utente non viene propagato", () => {
  const regole = normalizzaRegole({ segnaposto: ["mio/default.png"] });
  assert.equal(isSegnaposto("mio/default.png", regole), true);
  assert.equal(decideTokenArt(attore("mio/default.png", DEFAULT), { regole }).sync, false);
  assert.equal(isSegnaposto("mio/default.png"), false);   // senza la regola e' arte vera
});

test("un prefisso aggiunto dall'utente conta come segnaposto", () => {
  const regole = normalizzaRegole({ prefissi: ["icons/svg/", "sistema/default/"] });
  assert.equal(isSegnaposto("sistema/default/x.png", regole), true);
});

test("la cartella delle miniature e' configurabile, e vuota la disattiva", () => {
  const regole = normalizzaRegole({ cartellaMiniature: "/small/" });
  assert.equal(isMiniatura("t/small/a.webp", "t/a.webp", regole), true);
  assert.equal(isMiniatura("t/thumbs/a.webp", "t/a.webp", regole), false);
  const senza = normalizzaRegole({ cartellaMiniature: "" });
  assert.equal(isMiniatura("t/thumbs/a.webp", "t/a.webp", senza), false);
});

/* --- anello dinamico --- */

const conAnello = (img, src, soggetto) => ({
  img, type: "npc",
  prototypeToken: { texture: { src }, ring: { enabled: true, subject: { texture: soggetto } } }
});

test("anello: il soggetto che seguiva il vecchio ritratto segue anche il nuovo", () => {
  const a = conAnello("assets/vecchia.png", "assets/vecchia.png", "assets/vecchia.png");
  const esito = decideTokenArtUpdate(a, { img: "assets/nuova.png" });
  assert.deepEqual(esito, { sync: true, src: "assets/nuova.png", anello: true });
  assert.deepEqual(upd(esito.src, esito), {
    "prototypeToken.texture.src": "assets/nuova.png",
    [CAMPO_ANELLO]: "assets/nuova.png"
  });
});

test("anello: un soggetto scelto apposta non si tocca, il token si allinea comunque", () => {
  const a = conAnello("assets/vecchia.png", "assets/vecchia.png", "assets/soggetto-scelto.png");
  const esito = decideTokenArtUpdate(a, { img: "assets/nuova.png" });
  assert.equal(esito.sync, true);
  assert.equal(esito.anello, undefined);
  assert.deepEqual(upd(esito.src, esito), { "prototypeToken.texture.src": "assets/nuova.png" });
});

test("anello spento o senza soggetto: nessun campo in piu'", () => {
  const spento = { img: "a", type: "npc", prototypeToken: { texture: { src: "a" }, ring: { enabled: false, subject: { texture: "a" } } } };
  assert.equal(decideTokenArtUpdate(spento, { img: "b" }).anello, undefined);
  const vuoto = conAnello("a", "a", "");
  assert.equal(decideTokenArtUpdate(vuoto, { img: "b" }).anello, undefined);
  assert.equal(decideTokenArtUpdate(attore("a", "a"), { img: "b" }).anello, undefined);
});

test("anello: se l'update imposta gia' il soggetto, comanda lui", () => {
  const a = conAnello("a", "a", "a");
  assert.equal(decideTokenArtUpdate(a, { img: "b", [CAMPO_ANELLO]: "scelto" }).sync, false);
});

/* --- allineamento degli attori esistenti --- */

test("piano: allinea i token vuoti o al segnaposto, lascia stare gli altri e dice perche'", () => {
  const attori = [
    { id: "1", name: "Lamia", ...attore("assets/Lamia.png", DEFAULT) },
    { id: "2", name: "Willow", ...attore("assets/gildan.webp", "assets/Elf.png") },
    { id: "3", name: "Drago", ...attore(DRAGO, DRAGO) },
    { id: "4", name: "GiaOk", ...attore("assets/x.png", "assets/x.png") },
    { id: "5", name: "Anello", ...conAnello("assets/r.png", DEFAULT, DEFAULT) }
  ];
  const piano = pianoAllineamento(attori);
  assert.deepEqual(piano.daAllineare.map(p => p.id), ["1", "5"]);
  assert.equal(piano.daAllineare[0].src, "assets/Lamia.png");
  assert.equal(piano.daAllineare[1].anello, true);
  assert.equal(piano.saltati.length, 3);
  for (const s of piano.saltati) assert.ok(s.motivo.length > 0);
  assert.equal(piano.riepilogo["il token ha gia' arte sua"], 1);
});

test("piano: soloPng e regole personalizzate valgono anche in blocco", () => {
  const pg = { id: "1", name: "PG", img: "assets/a.png", type: "character", prototypeToken: { texture: { src: DEFAULT } } };
  assert.equal(pianoAllineamento([pg], { onlyNpc: true }).daAllineare.length, 0);
  assert.equal(pianoAllineamento([pg]).daAllineare.length, 1);
});

test("piano: un elenco vuoto o malformato non esplode", () => {
  assert.deepEqual(pianoAllineamento([]).daAllineare, []);
  assert.equal(pianoAllineamento([null, {}]).daAllineare.length, 0);
});

/* --- token gia' in scena --- */

import { tokenInScenaDaAllineare } from "../module/lib/arte-token.mjs";

const inScena = (src, ring) => ({ texture: { src }, ...(ring ? { ring } : {}) });
const cambio = { imgVecchia: "assets/vecchio.png", srcVecchio: "assets/vecchio-token.png", imgNuova: "assets/nuovo.png" };

test("un token in scena col ritratto vecchio segue il nuovo", () => {
  assert.deepEqual(tokenInScenaDaAllineare(inScena("assets/vecchio.png"), cambio), { "texture.src": "assets/nuovo.png" });
});

test("un token in scena con l'arte del prototipo vecchio segue anche lui", () => {
  assert.deepEqual(tokenInScenaDaAllineare(inScena("assets/vecchio-token.png"), cambio), { "texture.src": "assets/nuovo.png" });
});

test("un token in scena al segnaposto si riempie", () => {
  assert.deepEqual(tokenInScenaDaAllineare(inScena(DEFAULT), cambio), { "texture.src": "assets/nuovo.png" });
});

test("un token in scena con arte sua resta com'e'", () => {
  assert.equal(tokenInScenaDaAllineare(inScena("assets/scelto-apposta.png"), cambio), null);
});

test("un ritratto nuovo segnaposto non finisce mai su un token in scena", () => {
  assert.equal(tokenInScenaDaAllineare(inScena("assets/vecchio.png"), { ...cambio, imgNuova: DRAGO }), null);
});

test("un token gia' allineato non produce scritture", () => {
  assert.equal(tokenInScenaDaAllineare(inScena("assets/nuovo.png"), cambio), null);
});

test("un token non collegato (senza prototipo) segue solo il ritratto vecchio", () => {
  const sintetico = { ...cambio, srcVecchio: null };
  assert.deepEqual(tokenInScenaDaAllineare(inScena("assets/vecchio.png"), sintetico), { "texture.src": "assets/nuovo.png" });
  assert.equal(tokenInScenaDaAllineare(inScena("assets/vecchio-token.png"), sintetico), null);
});

test("l'anello dinamico del token in scena segue con la stessa regola", () => {
  const anello = { enabled: true, subject: { texture: "assets/vecchio.png" } };
  assert.deepEqual(tokenInScenaDaAllineare(inScena("assets/scelto-apposta.png", anello), cambio),
    { "ring.subject.texture": "assets/nuovo.png" });
});

/* --- soloPng in Daggerheart --- */

test("soloPng tiene dentro gli avversari di Daggerheart", () => {
  const avversario = { img: "assets/a.png", type: "adversary", prototypeToken: { texture: { src: "assets/a.png" } } };
  assert.equal(decideTokenArtUpdate(avversario, { img: "assets/b.png" }, { onlyNpc: true }).sync, true);
});

test("un token non collegato che mostra l'arte dell'attore del mondo la segue, anche al secondo cambio", () => {
  // Il Courtier: ritratto della copia gia' cambiato una volta, token ancora all'arte del mondo.
  const courtier = { imgVecchia: "assets/lady.png", srcVecchio: null, imgNuova: "assets/altra.png",
                     origine: ["assets/elf-king.png", "assets/elf-king.png"] };
  assert.deepEqual(tokenInScenaDaAllineare(inScena("assets/elf-king.png"), courtier), { "texture.src": "assets/altra.png" });
  assert.equal(tokenInScenaDaAllineare(inScena("assets/scelto-apposta.png"), courtier), null);
});
