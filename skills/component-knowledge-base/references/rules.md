# Knowledge base rules

The rules every component `docs/` folder obeys, during the first build and on every later change.
Copy this section into the repository's `CLAUDE.md` or `AGENTS.md` so it applies to all work, not
only when the skill runs.

## Knowledge base

The why, the history and the flows of a component live in a **`docs/` folder inside that
component's own folder**. If the repository builds a docs site, it collects every one of them into
a components section.

- **One `docs/` per module, beside its code — never one shared folder at the root of `src/`.**
  Knowledge about auth goes in `src/auth/docs/`, about billing in `src/billing/docs/`:

  ```text
  src/auth/docs/overview.md       ✓ auth only
  src/billing/docs/overview.md    ✓ billing only
  src/docs/auth.md                ✗ never
  ```

  Use the smallest folder that owns the fact. Knowledge spanning modules goes in the lowest module
  that owns it; system-wide architecture goes in the repository's architecture doc.
- **Read a folder's `docs/` before changing that folder, and update it in the same commit** when
  the change alters behaviour, a decision or a flow it describes.
- **Write in the repository's language** — docs, commit messages and comments alike — whatever
  language the conversation is in.
- **A folder gets `docs/` only when it owns knowledge**: a decision, a non-obvious flow or a
  deliberate non-fix. The domain layer holds rules and formats; orchestration holds end-to-end
  flows; UI holds only real contracts and traps. User-facing behaviour belongs in the user guide,
  not here.
- **Files**: `overview.md` is required; `flows.md` (Mermaid), `decisions.md`, `history.md` and
  `known-issues.md` exist only when they have content.
- **Links follow the dependencies.** A consumer's docs link down to what they build on; a lower
  layer's docs never list their consumers — that is what Find References is for.
- **Register every page in the docs site's table of contents**, if there is one: the overview as
  the module's entry, and `flows.md`, `decisions.md`, `history.md` or `known-issues.md` as its
  children in the same commit that creates them. Render the site with no new warnings.
- **Never write a guessed reason as fact.** A reason that neither the code, the history nor the
  owner confirmed is marked `Unconfirmed`.
