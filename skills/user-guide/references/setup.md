# Setting up a guide

How to start a guide from nothing, and how to bring an existing one under the rules. The examples
set up a guide for Sample Viewer, made by Sample Co, whose first area is the Library.

`<skill>` in a command is the folder the `user-guide` skill is installed in, so the scripts run
as `quarto run <skill>/scripts/check-guide.ts …`.

## What it needs

- **Quarto 1.10 or later**, tested on 1.10.18. Quarto ships Typst and the Deno runtime the
  scripts run on, so nothing else is installed: no LaTeX, no Node.
- **The guide lives in `docs/`.** The placeholder card prints `docs/images` as the place to save a
  capture, and the rules and examples assume that folder.

## 1. Copy the templates

Copy everything under `<skill>/templates/` into `docs/`, keeping the tree:

```text
docs/
├── _quarto.yml          Typst PDF settings; HTML off
├── _brand.yml           the logo, off until there is one
├── user-guide.qmd       the spine: title, List of Tables, header, chapter includes
├── OPEN-QUESTIONS.md    never rendered
├── _chapters/
│   ├── 01-getting-started.md
│   ├── 02-area.md       one per area: renamed 02-library.md below
│   ├── 10-settings.md
│   ├── A0-terms.md
│   ├── A1-troubleshooting.md
│   └── A2-message-index.md
└── images/
    └── IMAGES.md
```

## 2. Fill the tokens

Replace every token in every copied file:

| Token | What it is | Sample Viewer |
| :--- | :--- | :--- |
| `[[APP_NAME]]` | The app's name as its title bar shows it | `Sample Viewer` |
| `[[COMPANY]]` | Who makes it, under the title | `Sample Co` |
| `[[AREA_NAME]]` | The first area's name as the app shows it | `Library` |
| `[[AREA_ID]]` | That name as an id: lowercase, words joined by `-` | `library` |
| `[[CAPTURE_IT]]` | One line: how to take a screenshot of this app | see below |

- **`[[APP_NAME]]` also lands in a raw Typst block**, the running header in `user-guide.qmd`.
  There, put a backslash before each `#`, `$`, `_`, `@`, `*`, `` ` ``, `[` or `]` in the name, or
  the header breaks: `Sample_Viewer #2` becomes `Sample\_Viewer \#2` in that one line only. Look at
  the header in the first render either way.
- **`[[CAPTURE_IT]]` says how to take the picture**, not where to put it: the card already says to
  save it under its file name in `docs/images` and mark its row captured. Use the app's own capture
  feature if it has one, else the tool of the OS the users run. The token is replaced by one line
  of text, after the `Capture it:` that is already there. Examples of that text:

  ```text
  Windows: Press Windows+Shift+S, drag over the part of the window the card describes, then paste the clip into Paint and save it as PNG.
  macOS:   Press Shift+Command+4, drag over the part of the window the card describes; the PNG lands on the desktop.
  ```

  The placeholder card script refuses to run while this line still holds the token, unless it is
  given `--capture`.
- **No token survives**, not even inside a code block: the check fails on any `[[…]]` in the spine
  or a chapter.

## 3. Set the chapter list

The spine's includes are hard-coded, one `{{< include >}}` per chapter with a
`{{< pagebreak >}}` between them. Make them the guide's own chapters (layout and numbering:
[writing.md](writing.md)):

- **Rename `02-area.md`** to the area's id, and its include line with it:
  `02-area.md` → `02-library.md`.
- **Add an area**: copy `<skill>/templates/_chapters/02-area.md` to the next free number, fill its
  `[[AREA_NAME]]` and `[[AREA_ID]]`, and change the `02-` of its overview picture to the new
  number, in the figure and in that picture's `IMAGES.md` row if it has one yet:
  `images/02-viewer-overview.png` becomes `images/03-viewer-overview.png`. Then add its include
  where the chapter belongs, with a page break before it. Sample Viewer's Viewer area is
  `03-viewer.md` (`Viewer`, `viewer`):

  ```text
  {{< include _chapters/02-library.md >}}

  {{< pagebreak >}}

  {{< include _chapters/03-viewer.md >}}
  ```
- **Drop a starter chapter the app has no use for**: delete the file, its include and its page
  break, its pictures and their rows in `IMAGES.md`, and every `@sec-` that points at it. The other
  templates point at `@sec-settings`, so dropping `10-settings.md` means:

  ```bash
  grep -rn "@sec-settings" docs
  ```

  Plain `grep`, because the copied files are not in git yet and `git grep` skips them.

  A reference left behind is a render warning, which fails the check.
- **Keep the appendices after the raw Typst block that resets the heading counter**, and every
  other chapter before it, reference chapters included. The block is what letters the appendices
  A, B, C; a chapter included after it is lettered as an appendix.
- **Then delete the spine's `<!-- Template:` line.**

## 4. Rewrite every chapter from the code

**All the sample prose in the templates is invented**: every label, default, step and message in
them is an example of the shape, not a fact about any app. Each chapter carries one
`<!-- Template: … -->` line under its heading. Rewrite the whole chapter from the code
([sourcing.md](sourcing.md), [writing.md](writing.md)), then delete that line. The check fails
while any marker remains; with `--draft` it only warns.

## 5. Pictures

The templates point at three pictures: `01-main-window.png`, `02-<area id>-overview.png`
(`02-library-overview.png`) and `10-settings.png`, and each area added in step 3 brings one more
overview (`03-viewer-overview.png`). A render fails while any of them is missing, so capture each
one or make its card before the first render ([screenshots.md](screenshots.md)).

## 6. Logo

Skip this while the project has no logo.

1. Put the file in `docs/brand/`: `docs/brand/logo.png`. Not in `docs/images/`, where the check
   demands an `IMAGES.md` row for every file.
2. Uncomment the `logo:` block in `docs/_brand.yml` and the `logo:` geometry in `docs/_quarto.yml`,
   together. Leave `meta: {}` in `_brand.yml`.
3. Render and look at a body page: the logo lands on every page, so it must fit inside the top
   margin ([quarto.md](quarto.md)).

## 7. Version stamp

The title page and the running header read the `subtitle`, which is `Unversioned` by hand. The
build that ships the app renders with its version, so a printed page says which build it
describes:

```bash
quarto render docs/user-guide.qmd -M subtitle="Version 2.3.0"
```

The PDF is `docs/_output/user-guide.pdf`. The check renders without a version; render again with
the stamp after it passes.

- **A build that is not a release stamps a version nobody can take for one**: the nearest tag, how
  far past it the build is, the commit, and the word draft, never the bare tag of the last release.
  `git describe --tags` prints `v2.3.0-14-ga1b2c3d` for such a build, which reads
  `Version 2.3.0 +14 (a1b2c3d, draft)` on the page. A build exactly on the tag prints `v2.3.0` and
  reads `Version 2.3.0`.
- **A build with no tag to describe** (`git describe --tags` fails) is rendered without `-M`, so it
  reads `Unversioned`.
- **When the app ships the PDF** (a Help command opens it), the release renders the guide before it
  packages the app, so each release carries the guide that describes it. The PDF is build output,
  never committed.

## 8. Ignore the render output

A render writes `docs/_output/`, `docs/.quarto/` and the kept `docs/user-guide.typ`. Add them to
the project's `.gitignore`:

```text
docs/_output/
docs/.quarto/
docs/user-guide.typ
```

## 9. HTML, only if asked

The PDF is the guide. To publish the same chapters as a page as well, uncomment the `html:` block
in `docs/_quarto.yml`; the render then also writes `docs/_output/user-guide.html`. Drawings made
in Typst appear in the PDF only ([writing.md](writing.md)).

## 10. Offer the release check and the version stamp

Offer to do two things in the project's release script or CI, and edit either only on a yes: call
the check, and render the PDF with the version stamp ([step 7](#7-version-stamp)) once the check
passes.

```bash
quarto run <skill>/scripts/check-guide.ts --docs docs
quarto render docs/user-guide.qmd -M subtitle="Version 2.3.0"
```

The check prints one `ERROR:` or `WARN:` line per problem and exits 1 on any `ERROR:`, so the
release stops on a card, a template marker or a render warning. `WARN:` lines appear only with
`--draft` and never fail it; a release check never passes `--draft`. The release's own version
fills the stamp: the tag it builds, or the `git describe --tags` form for a build that is not a
release. CI needs the tags for that, so its checkout fetches the full history.

A CI runner has no skill installed, so CI runs a copy of the check:

- **Copy `<skill>/scripts/check-guide.ts` and `<skill>/scripts/quarto.ts` into one folder** in the
  repository, `build/user-guide/`. They must sit side by side: `check-guide.ts` imports
  `./quarto.ts`.
- **CI calls the copy**, on a runner with Quarto 1.10 or later:

  ```bash
  quarto run build/user-guide/check-guide.ts --docs docs
  ```
- **Never edit the copy.** Re-copy both files whenever the skill's scripts change.
- **Only the check is copied.** The card script also needs its `placeholder-card.typ` and runs from
  the installed skill, never from CI.

## 11. In-app links, only if the project wants them

Some apps open the guide at a section from a message ("See Library > When a folder is missing in
the user guide"). That needs app code, so set it up only when the owner asks for it:

- **`docs/help-topics.yml` lists every id the app may open**, with the chapter and section a
  message shows the user in words:

  ```yaml
  topics:
    - id: sec-library-missing-folder
      chapter: Library
      section: When a folder is missing
  ```
- **Each id sits on a plain heading** in a chapter: `## When a folder is missing {#sec-library-missing-folder}`.
  Never inside a `:::` callout, which renders no PDF destination, so a link to it opens page one.
- **An id is never renamed or given to another section.** A section that is cut has its id retired
  from the file and from the app's code, and its messages repointed.
- **A new message that points into the guide adds its id to the file first**, then to the app's
  code, and gets a row in the message index.
- **A test in the app keeps the code's list of ids and the file in step**, failing the app's build
  when one has an id the other lacks.
- The id is a named destination in the PDF, so a viewer that takes one opens the section itself:
  `user-guide.pdf#nameddest=sec-library-missing-folder`.

## 12. Offer the rules

Offer to copy the section in [rules.md](rules.md) into the project's `CLAUDE.md` or `AGENTS.md`,
so later changes keep the guide right.

## Bringing an existing guide under the rules

When the project already has a Quarto guide, fit it to the layout the scripts expect, then copy
only what it lacks.

- **The layout**: the spine is `docs/user-guide.qmd`, the chapters are `.md` files in
  `docs/_chapters/`, and every picture is in `docs/images/`. The check reads only those; a chapter
  anywhere else is never checked, and a missing `docs/user-guide.qmd` is the only error it prints.
  Move and rename what differs, and update the spine's includes and the figure paths with it.
- **A guide that keeps its own folder** gets `--docs <that folder>` on both scripts instead, as
  long as the folder holds that layout. The card still tells its reader to save the capture in
  `docs/images`, so prefer moving the guide to `docs/`.
- **Copy `<skill>/templates/images/IMAGES.md`** to `docs/images/IMAGES.md`, fill its `Capture it:`
  line ([2. Fill the tokens](#2-fill-the-tokens)), and add a `captured` row for every picture
  already there. The card script refuses to run while that line still holds `[[`.
- **Copy `<skill>/templates/OPEN-QUESTIONS.md`** to `docs/OPEN-QUESTIONS.md`.
- **Run the check with `--draft`** and fix what it reports. From then on, apply the rules to each
  chapter a change touches, not to the whole guide at once.
