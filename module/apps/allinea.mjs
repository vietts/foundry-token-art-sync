import * as arte from "../lib/arte-token.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

const esc = testo => String(testo ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nomeFile = src => decodeURIComponent(String(src).split("/").pop());

/** Legge le impostazioni e le trasforma nella forma che la libreria si aspetta. */
export function leggiRegole() {
  return arte.normalizzaRegole({
    segnaposto: arte.parseElenco(game.settings.get(arte.MODULE_ID, "segnaposto")),
    prefissi: arte.parseElenco(game.settings.get(arte.MODULE_ID, "prefissi")),
    cartellaMiniature: game.settings.get(arte.MODULE_ID, "cartellaMiniature").trim()
  });
}

export const leggiOpzioni = () => ({
  onlyNpc: game.settings.get(arte.MODULE_ID, "soloPng"),
  regole: leggiRegole()
});

/** Il piano sugli attori del mondo, senza scrivere niente. */
export function pianoMondo() {
  const attori = game.actors.map(a => ({
    id: a.id, name: a.name, img: a.img, type: a.type,
    prototypeToken: a.prototypeToken.toObject()
  }));
  return arte.pianoAllineamento(attori, leggiOpzioni());
}

/** Applica un piano gia' calcolato: una scrittura sola per tutti gli attori. */
export async function applicaPiano(piano) {
  const updates = piano.daAllineare.map(p => ({ _id: p.id, ...arte.tokenArtUpdate(p.src, p) }));
  if (updates.length) await Actor.updateDocuments(updates);
  return updates.length;
}

function contenuto(piano) {
  const righe = piano.daAllineare.map(p =>
    `<tr><td>${esc(p.name)}</td><td><code>${esc(nomeFile(p.src))}</code>${p.anello ? " (anello)" : ""}</td></tr>`).join("");
  const motivi = Object.entries(piano.riepilogo)
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, n]) => `<li>${n} — ${esc(motivo)}</li>`).join("");
  return `
    <p><strong>${piano.daAllineare.length}</strong> attori da allineare,
       <strong>${piano.saltati.length}</strong> lasciati come sono.</p>
    ${righe ? `<div style="max-height:240px;overflow:auto"><table style="width:100%"><thead><tr><th>Attore</th><th>Il token diventa</th></tr></thead><tbody>${righe}</tbody></table></div>` : ""}
    ${motivi ? `<details><summary>Perche' gli altri restano</summary><ul>${motivi}</ul></details>` : ""}`;
}

/**
 * Mostra l'anteprima e, se l'utente conferma, scrive. Non tocca mai un token che ha gia' arte sua:
 * la regola e' quella della nascita (solo token vuoti o al segnaposto).
 */
export async function allinea({ dryRun = false } = {}) {
  const piano = pianoMondo();
  if (dryRun) return piano;
  if (!piano.daAllineare.length) {
    await DialogV2.prompt({ window: { title: "Arte del token" }, content: contenuto(piano), ok: { label: "Chiudi" } });
    return piano;
  }
  const conferma = await DialogV2.confirm({
    window: { title: "Allinea i token esistenti" },
    content: contenuto(piano),
    yes: { label: `Allinea ${piano.daAllineare.length} attori` },
    no: { label: "Annulla" }
  });
  if (!conferma) return piano;
  const n = await applicaPiano(piano);
  ui.notifications.info(`Arte del token: ${n} attori allineati.`);
  return piano;
}

/** Il bottone nelle impostazioni del modulo: apre il dialogo, non una finestra sua. */
export class AllineaMenu extends ApplicationV2 {
  async render() {
    await allinea();
    return this;
  }
}
