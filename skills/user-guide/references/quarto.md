# Quarto and Typst traps

The traps the templates already work around, and how to read what a render prints. Each was hit in
a real guide; keep the template line that handles it.

## Traps

- **An id goes on a plain heading, never inside a `:::` callout.** An id inside a callout is
  dropped: a `@sec-` to it is an unresolved cross-reference, and the PDF has no destination for it,
  so a link from the app lands on page one.

  ```markdown
  ## When a folder is missing {#sec-library-missing-folder}     ✓

  ::: {.callout-note}
  ## When a folder is missing {#sec-library-missing-folder}     ✗
  :::
  ```

- **`lot: true` does nothing in Typst.** Quarto's reference lists it, but the Typst writer emits no
  List of Tables. The spine builds one by hand with `#outline(target: figure.where(kind:
  "quarto-float-tbl"))`. Only captioned tables are figures of that kind, which is why every table
  needs its `: Caption {#tbl-…}` line.
- **Cross-reference colour is `citecolor`.** `@sec-`, `@fig-` and `@tbl-` compile to Typst `ref`
  elements, which the template colours with `citecolor`, not `linkcolor`. Change the colour of
  cross-references there in `_quarto.yml`.
- **A brand logo lands on every page**, not only the title page: Quarto compiles it to a page
  background. Size it to fit inside the top margin with the `logo:` geometry in `_quarto.yml`
  (`width`, `padding-top`, `padding-right`), so it never overprints the text or the Contents. A
  taller logo needs the file, the width or the padding changed.
- **`_brand.yml` needs at least one key.** A file holding only comments fails with "Brand validation
  failed"; leave `meta: {}` in it.
- **Keep the `.typ`** (`keep-typ: true`). A render leaves `docs/user-guide.typ`, the exact Typst
  that made the PDF. Read it at the line a Typst error names, or compile it alone to look at pages
  without the whole pipeline:

  ```bash
  quarto typst compile docs/user-guide.typ "page-{p}.png" --ppi 72
  ```

- **Callout icons need Font Awesome**, which is often missing, and never on a CI runner: a missing
  glyph renders as a box. The template sets `callout-icon: false`.
- **A long captioned table would not break across pages**: a Typst figure is one unbreakable block,
  so rows past the bottom margin are drawn on top of each other. The spine's
  `#show figure.where(kind: "quarto-float-tbl"): set block(breakable: true)` fixes it for tables
  only; keep it.
- **The running header is raw Typst.** The app name in it needs `#`, `$`, `_`, `@`, `*`,
  `` ` ``, `[` and `]` escaped with a backslash ([setup.md](setup.md)).
- **Only the spine is rendered.** `_quarto.yml` lists `user-guide.qmd` under `render:`; without it
  Quarto also renders `OPEN-QUESTIONS.md` and `IMAGES.md` as documents. Chapters sit in
  `_chapters/` because Quarto skips files and folders whose names start with `_`.

## Zero warnings

A render must print no warning. A warning means a broken reference or a missing picture in the PDF,
not noise. The check fails on any render line that contains `warn` or `warning`, and on a render
that exits non-zero.

## Reading a render warning

The check prints each render problem as `ERROR: render: <line>`. A plain `quarto render` prints
the same line, with the Lua filter's path in front of a warning; ignore the path.

| What it prints | What it means | Fix |
| :--- | :--- | :--- |
| `Unable to resolve crossref @sec-library-search` | No heading carries that id | Fix the spelling, include the chapter, move the id out of a callout, or remove the reference to a dropped chapter |
| `Unable to resolve crossref @fig-library-status-colours` with HTML on | The figure is PDF only | Introduce the drawing in words instead ([writing.md](writing.md)) |
| `file not found (searched at …02-library-search.png)`, then `Typst compilation failed` | The figure points at a picture that is not there | Capture it, or make its card ([screenshots.md](screenshots.md)) |
| `Brand validation failed for …_brand.yml` | `_brand.yml` has no keys | Put `meta: {}` back |
| A Typst `error:` naming `user-guide.typ` and a line | Raw Typst that does not compile: a drawing, or an unescaped app name in the header | Read `docs/user-guide.typ` at that line, then fix the source it came from |

Fix the first error first: one Typst error stops the compile, and the lines after it are often
its consequences.
