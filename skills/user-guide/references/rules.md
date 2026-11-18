# User guide rules

The rules an end-user guide obeys on every change, not only when the skill runs. Copy the section
below into the repository's `CLAUDE.md` or `AGENTS.md`, so it stands on its own there.

Never paste the skill's install path: it carries the plugin's version and breaks on the next
update. When pasting:

- **The check** runs from the project's own copy once there is one
  ([setup.md](setup.md), step 10): replace `<skill>/scripts/check-guide.ts` with that path,
  `build/user-guide/check-guide.ts`.
- **The card** runs only from the installed skill. Keep `<skill>` in its command and add, under the
  heading, "`<skill>` is the folder of the installed `user-guide` skill; load the skill to find
  it."
- **Add what the project's guide holds that the section does not**: its chapter layout when it
  was adopted with its own numbering, the code that links into the guide, its capture shortcut.

## User guide

The guide for the app's users is a Quarto PDF in `docs/`: the spine `docs/user-guide.qmd`, one
file per chapter in `docs/_chapters/`, every picture in `docs/images/`.

- **A change that alters what a user sees updates the guide in the same commit**: a label, a menu
  path, a flow, a setting or its default, a permission, a message. Find what it touches by
  searching for the old text, then the pictures by their rows in `docs/images/IMAGES.md`. Renaming
  the Library's **Search** box to **Filter**:

  ```text
  git grep -n "Search" docs/_chapters          the steps, tables and the message index
  git grep -n "Search" docs/images/IMAGES.md   the pictures that show the box
  ```

- **Every fact comes from the code**: each label, menu path, default, permission and message is
  quoted exactly as the app shows it, in the guide's language, and each "how to get there" is
  traced from the code. Agent memory is a lead, never a fact.
- **Nothing unconfirmed reaches the guide**, not even marked. It goes in `docs/OPEN-QUESTIONS.md`
  as one numbered item: the question, where it came from, what will be written for each answer.
  When the answer comes, write it into its chapter and delete the item.
- **A section two areas share lives once**, in the chapter that owns it; the other links to it
  with `@sec-…` instead of repeating it.
- **The message index lists every titled dialog and every refusal, warning or error a user can
  read long enough to act on**, quoted exactly; a notification that closes on its own stays out. A
  change that adds, rewords or removes one changes its row. A long index is grouped by when the
  message appears, sorted by title inside each group.
- **Pictures by default**: one per screen or dialog a user meets, named
  `<chapter number>-<what>.png` in `docs/images/`, where the chapter number is the chapter file's
  prefix (`02-library-search.png` for the Library chapter, `02-library.md`). A chapter file that is
  renumbered renames its pictures with it; the check warns about a picture named for no chapter
  that uses it.
- **`docs/images/IMAGES.md` lists every picture**, one row each, with status `captured` or
  `placeholder: <why>`. Its Section cell is the id of the heading the picture sits under, which
  gets one if it has none; a picture used in more than one section lists each id, separated by
  commas. A picture with no row, a row with no picture, or a picture no chapter uses
  fails the check:

  ```text
  | `02-library-search.png` | sec-library-search | The Library list narrowed by Search | Open Sample Viewer, choose Library, type "tile" in Search | captured |
  ```

- **A stale picture becomes a card** until it is retaken. Stale means its layout, controls, labels
  or columns changed; colour or font drift alone is not stale. The card comes from the script,
  never drawn by hand, and the script also rewrites the picture's row:

  ```bash
  quarto run <skill>/scripts/placeholder-card.ts --docs docs --file 02-library-search.png \
    --section sec-library-search --shows "The Library list narrowed by Filter" \
    --how "Open Sample Viewer, choose Library, type tile in Filter" \
    --why "stale: Search was renamed Filter"
  ```

  Run it on a `captured` picture only when that picture is stale; it replaces the screenshot, and
  only git keeps the old one.
- **Section ids are a contract when the app links into the guide** (`docs/help-topics.yml`). An id
  sits on a plain heading, never inside a `:::` callout, and is never renamed or given to another
  section. A section that is cut has its id retired from `docs/help-topics.yml` and from the app's
  code, and the messages that pointed at it repointed.
- **The check passes before a release**: it renders the guide and fails on any render warning, an
  uncaptioned table, a picture still a card, a picture and row out of step, or template text left
  in. `--draft` reports cards and template text without failing, for work in progress only.

  ```bash
  quarto run <skill>/scripts/check-guide.ts --docs docs
  ```
