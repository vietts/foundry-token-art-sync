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
