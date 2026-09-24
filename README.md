# Token Art Sync (`arte-token`)

A Foundry VTT module (v14, any game system) that keeps an actor's **token art in sync with its
portrait**, without ever overriding a choice you made on purpose.

*Italiano: [README.it.md](README.it.md)*

## The rule

The everyday case is an **edit**, not a creation: an actor is born with the default token and you
give it a portrait afterwards. So:

- **On portrait change** — the token follows, but **only if it was already following**: if it
  matched the old portrait, or was still a placeholder. A token you differentiated on purpose stays.
- **On creation** — for compendium imports, which arrive with the portrait already in the payload.
  Only empty or placeholder tokens are filled.

Both write *before* the actual save, so a single update happens and the token never flashes wrong.

## What it never touches

- **Placeholder portraits** — never copied onto a token (Foundry's `icons/svg/` by default, plus
  your own list). A blind sync would otherwise stamp the placeholder over good art.
- **Thumbnail conventions** — when the portrait is `…/thumbs/x` and the token is `…/x`
  (dnd5e), they are the same art at two resolutions; syncing would lower the token's quality.
- **Wildcard tokens** (`randomImg`).
- **Tokens already chosen** — one that arrives with its own art, or that wasn't following.

## Settings

*Configure Settings → Module Settings*

- **Sync the token to the portrait** — master switch (default: on)
- **NPCs only** — leave player characters (`character`) out; dnd5e `npc` and Daggerheart `adversary` stay in (default: off)
- **Placeholder portraits**, **Placeholder folders**, **Thumbnail folder** — the "what is not real
  art" rules, one entry per line. Defaults cover Foundry's built-in icons, the Daggerheart
  `dragon-head` placeholder and the dnd5e `/thumbs/` convention. Add your own system's.
- **Sync existing tokens…** — a button: preview, then a bulk write for actors that already
  exist. Only empty or placeholder tokens are filled. From a macro:
  `game.modules.get("arte-token").api.allinea({ dryRun: true })` returns the plan without writing.

## Dynamic token ring

With the ring enabled and its own subject (`ring.subject.texture`), that subject **overrides** the
token art, so syncing `texture.src` alone would be invisible. The subject follows by the same rule as
the token: only if it was a placeholder or matched the old portrait.

## Known limits

- Changing a portrait also updates the tokens **already placed** on every scene, by the same rule:
  only those that showed the old portrait, the old prototype art or a placeholder. A token given
  its own art stays as it is.
- Changing the portrait from the sheet of an **unlinked token** updates only that token (its
  prototype doesn't exist on its own), if it was showing the old portrait.
- A player only updates tokens they own; the GM updates all of them.
- The sync goes portrait → token only. Changing the token never touches the portrait.
- The bulk button works on **world** actors, not on those inside compendiums.

## Development

    npm test          # Node's test runner, no dependencies

- `module/lib/arte-token.mjs` — the decision only: pure functions, no Foundry globals, fully
  tested. Every refusal carries a readable `motivo`, which makes a self-running automation debuggable.
- `module/arte-token.mjs` — the hooks and the settings
- `module/apps/allinea.mjs` — bulk preview and write (`DialogV2`)
- `deploy.sh` — rsync to your own server; see the variables at the top of the file

## Releasing

Create a GitHub release tagged `vX.Y.Z`: the workflow runs the tests, writes the version and
download URL into `module.json`, and attaches `module.json` + `module.zip`.

## License

MIT
