# User guide rules

The rules an end-user guide obeys on every change, not only when the skill runs. Copy the section
below into the repository's `CLAUDE.md` or `AGENTS.md`. In its commands, `<skill>` is the folder
the `user-guide` skill is installed in; if the project keeps its own copy of the scripts (see
[setup.md](setup.md)), write that path instead when pasting.

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
- **Pictures by default**: one per screen or dialog a user meets, named
  `<chapter number>-<what>.png` in `docs/images/` (`02-library-search.png` for the Library
  chapter, `02-library.md`).
- **`docs/images/IMAGES.md` lists every picture**, one row each, with status `captured` or
  `placeholder: <why>`. A picture with no row, or a row with no picture, fails the check:

  ```text
  | `02-library-search.png` | sec-library-search | The Library list narrowed by Search | Open Sample Viewer, choose Library, type "tile" in Search | captured |
  ```
- **A stale picture becomes a card** until it is retaken. Stale means its layout, controls, labels
  or columns changed; colour or font drift alone is not stale. The card comes from the script,
  never drawn by hand, and the script also rewrites the picture's row:

  ```bash
  quarto run <skill>/scripts/placeholder-card.ts --docs docs --file 02-library-search.png \
    --section sec-library-search --shows "The Library list narrowed by Search" \
    --how "Open Sample Viewer, choose Library, type tile in Search" \
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
