---
name: user-guide
description: 'Write and maintain the end-user guide of a desktop app - a Quarto PDF for its users, power users and admins - with every fact taken from the code, a picture for every screen or a standard placeholder card until one is taken, and nothing unconfirmed in the PDF. Use when asked to start a user guide, document the app for its users, update the user guide after a change, or retake or track its screenshots. Developer docs (why, history, flows) are component-knowledge-base''s job. Maintenance follows references/rules.md, which belongs in the repository''s CLAUDE.md or AGENTS.md so it applies on every change.'
---

# User guide

Builds and keeps the guide a desktop app's users open to understand it, learn a function, follow a
task or fix something that went wrong: a PDF in `docs/`, rendered by Quarto through Typst. The
reader is the normal user first, then power users and admins. Developer docs are
`component-knowledge-base`'s job.

The rules the guide obeys on every change are in [references/rules.md](references/rules.md); this
skill is the procedure. It needs **Quarto 1.6 or later** and nothing else: no LaTeX, no Node
([references/setup.md](references/setup.md)). `<skill>` in a command is the folder this skill is
installed in.

## In every mode

- **Never fabricate.** Every label, menu path, default, permission and message comes from the code,
  quoted exactly; agent memory is a lead, never a fact. Ask the owner what the code cannot say, in
  one interview. An unconfirmed item goes in `docs/OPEN-QUESTIONS.md`, never into the guide, not
  even marked ([references/sourcing.md](references/sourcing.md)).
- **Pictures by default**, one per screen or dialog a user meets. Capture one yourself only through
  the gate in [references/screenshots.md](references/screenshots.md): ask before launching or
  operating the app, use sample or test data only, and inspect each capture for private data.
  Otherwise, or at any doubt, make a placeholder card with `placeholder-card.ts`, never by hand.
- **The template text is invented.** Every chapter template's sample prose describes no real app.
  Rewrite the chapter from the code before deleting its `<!-- Template: … -->` line
  ([references/writing.md](references/writing.md)).
- **End every pass with a report**: each card still waiting, with what it shows and the steps to
  reach it (the form is in [references/screenshots.md](references/screenshots.md)), and each open
  question.

Pick the mode: **new** when `docs/` holds no guide; **maintain** when a guide under these rules
exists and a change alters what a user sees; **adopt** when a Quarto guide exists without
`docs/images/IMAGES.md` and `docs/OPEN-QUESTIONS.md`.

## New guide

1. **Decide the scope**: the app, its users, and the guide's language when the app shows more than
   one.
2. **Gather, read-only**: the screens, menus, settings and defaults, permissions and messages from
   the code, and how each screen is reached; git history where a reason helps a user; any existing
   docs; memory as leads ([references/sourcing.md](references/sourcing.md)).
3. **Propose the chapter list and interview once.** Lay the chapters out as
   [references/writing.md](references/writing.md) says: getting started, one per area in the order
   users meet them, the reference chapters the app has, the three appendices. Send the list with one
   numbered set of concrete questions; what stays unanswered goes in `docs/OPEN-QUESTIONS.md`
   once step 4 has copied it in.
4. **Set up** ([references/setup.md](references/setup.md)): copy `<skill>/templates/` into `docs/`,
   fill every token, set the spine's chapter list and delete its marker, add the logo if there is
   one, and ignore the render output. The version stamp is a render command for the release
   (setup.md, step 7); nothing in `docs/` changes for it.
5. **Write chapter by chapter** ([references/writing.md](references/writing.md)), each rewritten
   from the code before its marker goes. Capture each picture and add its row to
   `docs/images/IMAGES.md`, or make its card:

   ```bash
   quarto run <skill>/scripts/placeholder-card.ts --docs docs --file 02-library-search.png \
     --section sec-library-search --shows "The Library list narrowed by Search" \
     --how "Open Sample Viewer, choose Library, type tile in Search" --why "new picture"
   ```

   The pictures the templates point at need a capture or a card before the first render: three,
   and one overview more for each area added.
6. **Check as you go** until it prints no `ERROR:` line. `--draft` only warns on cards and template
   markers; `--no-render` skips the slow render. Read render warnings with
   [references/quarto.md](references/quarto.md).

   ```bash
   quarto run <skill>/scripts/check-guide.ts --docs docs --draft
   ```

7. **End with the release check**, without `--draft`:

   ```bash
   quarto run <skill>/scripts/check-guide.ts --docs docs
   ```

   Either it passes, or the report lists exactly what still blocks a release: each card it fails
   on, with its steps, and each open question that keeps a fact out of the guide. No template
   marker is left by now.
8. **Report and offer**: the waiting cards and open questions; to call the check from the project's
   release script or CI (setup.md, step 10), edited only on a yes; and the rules (below).

## Maintain after a change

1. **Find what the change touches**: search the chapters for the old text, and
   `docs/images/IMAGES.md` for the pictures that show it, by section id and what each row shows
   ([references/rules.md](references/rules.md)).
2. **Rewrite those sections from the code**, the message index included, in the same commit as the
   change ([references/sourcing.md](references/sourcing.md)). A new doubt goes in
   `OPEN-QUESTIONS.md`; an answered item goes into its chapter and leaves the file.
3. **Recapture each picture the change made stale**, through the gate, or turn it into a card with
   `placeholder-card.ts` and `--why "stale: <what changed>"`. Run it only on a stale picture: it
   overwrites a captured one ([references/screenshots.md](references/screenshots.md)). A new screen
   gets a picture or a card; a screen that is gone loses its picture, row and figure.
4. **Keep section ids**: never rename or reuse one; a cut section retires its id from
   `docs/help-topics.yml` and the app's code when the app links into the guide
   ([references/setup.md](references/setup.md#11-in-app-links-only-if-the-project-wants-them)).
5. **Run `check-guide.ts`**, with `--draft` while cards wait and without it before a release, then
   report.

## Adopt an existing guide

1. **Fit the layout** the scripts expect: the spine `docs/user-guide.qmd`, the chapters in
   `docs/_chapters/`, the pictures in `docs/images/`. Move and rename what differs, with its
   includes and figure paths, or point `--docs` at the folder that already has that layout
   ([references/setup.md](references/setup.md), "Bringing an existing guide under the rules").
2. **Add the tooling**: `docs/images/IMAGES.md` from the template with its `Capture it:` line
   filled (the card script refuses one still holding `[[`) and a `captured` row for every picture
   already there, and `docs/OPEN-QUESTIONS.md`.
3. **Run `check-guide.ts` with `--draft`** and fix what it reports.
4. **Apply the rules from then on**: audit and rewrite only the chapters a change touches, never the
   whole guide at once.
5. **Report and offer** as a new guide does.

## Offer the rules

Offer to paste the `## User guide` section of [references/rules.md](references/rules.md) into the
project's `CLAUDE.md` or `AGENTS.md`, with every `<skill>` replaced by the real path of the folder
this skill is installed in, so later changes keep the guide right. Edit the file only on a yes.
