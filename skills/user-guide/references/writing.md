# Writing the guide

How the guide is laid out and how each chapter reads. The reader is the app's normal user first,
then power users and admins. The guide must work read front to back and looked up in the middle.

## Layout and numbering

| File | Chapter | Present |
| :--- | :--- | :--- |
| `01-getting-started.md` | Install, first run or sign-in, the main window, the first task end to end | Always |
| `02-…` to `89-…` | One per main area or workflow, in the order a user meets them | One each |
| `90-…` to `99-…` | Reference: settings, keyboard shortcuts, roles and permissions, where files live | Only those the app has |
| `A0-terms.md` | Terms: each word that means something specific in this app | Always |
| `A1-troubleshooting.md` | Troubleshooting, by what the user sees | Always |
| `A2-message-index.md` | Every message worth looking up, and what to do | Always |

- **A file's number prefix places it in the scheme; only the spine sets the order** through its
  includes ([setup.md](setup.md) adds, renames and drops them). The printed chapter number follows
  the spine order, not the prefix: Sample Viewer's `90-settings.md` prints as chapter 4, after
  `01`, `02` and `03`. Picture names use the prefix (`90-settings.png`).
- **Areas take the next free number from `02`; reference chapters start at `90`.** The gap keeps
  room for every area an app has, so adding one never renumbers a reference chapter or its
  pictures. A tenth area is `11-…`, not a reason to move `90-settings.md`.
- **A section two areas share lives once**, in the chapter that owns it; the other links to it.

Sample Viewer's chapters:

```text
docs/_chapters/
├── 01-getting-started.md
├── 02-library.md          sec-library
├── 03-viewer.md           sec-viewer
├── 90-settings.md         sec-settings
├── 91-shortcuts.md        sec-shortcuts
├── A0-terms.md            sec-terms
├── A1-troubleshooting.md  sec-troubleshooting
└── A2-message-index.md    sec-message-index
```

## Ids

- **Every chapter heading and every section a link may point at gets an id**: `sec-` plus the
  area id plus the section in lowercase words joined by `-`. `## Search the Library {#sec-library-search}`.
- **Figures and tables use the same stem**: `#fig-library-search`, `#tbl-library-controls`.
- **An id goes on a plain heading**, never inside a `:::` callout ([quarto.md](quarto.md)).

## The template text is invented

Every chapter template is sample prose: its labels, defaults, steps and messages describe no real
app. Rewrite each chapter whole from the code ([sourcing.md](sourcing.md)), then delete its
`<!-- Template: … -->` line. The check fails while any marker remains.

## Chapter shape

1. The heading with its id, then one short paragraph: what this area is for, in the user's terms.
2. A picture of the area as it first opens.
3. A table of its controls, when there are more than two.
4. Its tasks, one `##` section each, titled by the task: "Open an item", "Remove an item".
5. A callout only for what the user must not miss, such as a step that cannot be undone.

## Style

- **Plain words.** Write for someone who has never seen the code. No internal names: no class,
  handler, resource key, log or config key names, unless an admin must type one.
- **Short numbered steps**, one action each: "Press **Open**." The result follows in the same step
  when the user should check it: "The list shrinks as you type."
- **UI labels in bold, quoted exactly as the app shows them** in the guide's language: **Search**,
  not **search box**. A menu path is **Library** > **Export**. A dialog that shows two languages is
  quoted in the guide's language only.
- **One picture per screen or dialog a user meets**, as a figure with a caption and an id:

  ```markdown
  ![The Library list narrowed by Search.](images/02-library-search.png){#fig-library-search width=90%}
  ```
- **Power-user detail goes in a reference table**, not in the middle of a task: a task says "Press
  **Export**"; the settings chapter says which formats it writes and where.
- **Link instead of repeating**: `@sec-library-search`, `@fig-library-search`, `@tbl-settings`.
- **No `[[…]]` anywhere in the guide**, not even inside a code block: the check reads it as an
  unfilled template token.
- **Keep each file's line endings.** Edit with a tool that preserves them, and check with
  `git ls-files --eol docs` before committing: a chapter that turned from CRLF to LF, or back,
  shows every line as changed.

## Tables

- **Every table carries a caption line right after it**, or it is missing from the List of Tables
  and the check fails:

  ```markdown
  | Setting | What it does | Default |
  | :--- | :--- | :--- |
  | **Confirm before deleting** | Asks before an item is removed. | On |

  : The settings and their defaults {#tbl-settings}
  ```
- **A short list that is not reference material is a bullet list**, not an uncaptioned table.
- **A `|` inside a cell is written `\|`.**

## Appendices

- **Terms**: each word the app uses in its own sense, what it means, and where the user sees it.
  Use the users' words from the interview.
- **Troubleshooting, by symptom**: each entry is titled by what the user sees ("The Library is
  empty"), then numbered checks in the order to try them, each with what to do.
- **The message index lists every titled dialog and every refusal, warning or error a user can read
  long enough to act on.** Passing notifications that close on their own stay out. One row each:
  the title in bold, the text in italics quoted exactly, and what to do, with a link to the section
  that explains it. Sorted by title, so a user finds it from the title bar:

  ```markdown
  | **Folder Missing** | *The folder* folder name *no longer exists.* | Choose another folder in **Library** > **Add Folder** (@sec-library-folders). |
  ```

  A variable part of the text is a plain word that names it inside the italics, as the folder name
  is above for the code's `"The folder {0} no longer exists."`.

## Illustrations

Where a screenshot cannot show it (a colour key, a simple layout, a step flow), draw it inline in
Typst. It needs nothing beyond Quarto. Other diagram tools (Mermaid, Graphviz) are not used.

- **A drawing appears in the PDF only.** Wrap it so an HTML render skips it.
- **Introduce it in the sentence before it and never cross-reference it**: with HTML on, an `@fig-`
  pointing at a drawing the HTML skips is a render warning.

A three-swatch colour key for the status of a Library item:

````markdown
Each item in the list shows its status as a colour:

::: {.content-visible when-format="typst"}

::: {#fig-library-status-colours}

```{=typst}
#let swatch(fill, label) = box[#box(width: 0.9em, height: 0.9em, fill: fill, radius: 2pt) #h(0.4em) #label]
#align(center, stack(dir: ltr, spacing: 2em,
  swatch(rgb("#2e7d32"), [Ready]),
  swatch(rgb("#f9a825"), [Processing]),
  swatch(rgb("#c62828"), [Failed]),
))
```

The colours of an item's status in the Library.

:::

:::
````

The inner `:::` with an id makes it a numbered figure with the last paragraph as its caption; the
outer one keeps it out of HTML. Take the colours and labels from the code, like any other fact.
