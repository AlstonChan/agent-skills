# Screenshots

Every screen or dialog a user meets gets a picture. Take it yourself when you can; when you cannot,
leave the standard card that says what to take and how. `<skill>` in a command is the folder the
`user-guide` skill is installed in.

## Capture it yourself, behind the gate

Capture when you can launch the app and drive it, or render a screen to an image off-screen (a test
harness that draws a window, say). Before any of it:

- **Ask before launching or operating the app.** Say what you will open and click.
- **Sample or test data only.** Never a production path, share, database or account.
- **Look at each capture before saving it** for customer names, user names, real paths, serial
  numbers, hostnames and credentials.
- **Any doubt means a card**, not a capture.

## Crop and name

- **Crop to the part the section is about**: the dialog, the panel, the toolbar. The whole window
  only for an overview. Keep a dialog's title bar; the message index finds a dialog by its title.
- **Name it `<chapter number>-<what>.png`**, lowercase words joined by `-`, saved in
  `docs/images/`. The chapter number is the chapter file's prefix, not the number the PDF prints:

  ```text
  01-main-window.png          01-getting-started.md
  02-library-search.png       02-library.md, the Search section
  90-settings-display.png     90-settings.md, the Display page
  A1-library-empty.png        A1-troubleshooting.md
  ```

- **PNG only**, so a card and the picture that replaces it share one name: the card script takes a
  plain `.png` file name and nothing else.
- **Place it in its section** as a figure ([writing.md](writing.md)):
  `![The Library list narrowed by Search.](images/02-library-search.png){#fig-library-search width=90%}`

## Record it in IMAGES.md

`docs/images/IMAGES.md` has one row per picture. A new capture gets a row added by hand under the
last one; a retaken card has its Status changed to `captured`:

```text
| `02-library-search.png` | sec-library-search | The Library list narrowed by Search | Open Sample Viewer, choose Library, type "tile" in Search | captured |
```

- **Columns**: the file name in backticks, the section id the picture sits in, what it shows, how
  to get there, the status (`captured`, or `placeholder: <why>`). A picture shown in more than one
  section lists every id, separated by commas (`sec-library-search, sec-viewer-open`), so a search
  for either section finds it; give the card script the same list in `--section`.
- **Leave the header and the `| :--- |` separator row as the template has them.** The card script
  recognises that separator and no other spelling of it (`|---|` is not found), and the check reads
  a line as a row only when it starts with `` | ` `` and the file name.
- **A `|` inside a cell is written `\|`.**
- **A picture whose screen is gone** is deleted with its row and its figure, in one commit.

## The card, when you cannot capture

Use the card when the gate says no, the app cannot run here, the screen needs hardware or data you
do not have, or the capture shows something it must not. Run the script; never draw a card by
hand, so every card looks the same:

```bash
quarto run <skill>/scripts/placeholder-card.ts --docs docs --file 02-library-search.png \
  --section sec-library-search --shows "The Library list narrowed by Search" \
  --how "Open Sample Viewer, choose Library, type tile in Search" --why "new picture"
```

| Argument | What it takes |
| :--- | :--- |
| `--docs` | The guide's folder: `docs` |
| `--file` | The picture's plain `.png` name, as the figure uses it |
| `--section` | The id of the nearest heading above the picture that has one, without `#` |
| `--shows` | What the picture must show |
| `--how` | The steps in the app to reach that screen, on one line |
| `--why` | `new picture`, or `stale: <what changed>` |
| `--capture` | Optional: how to take it, when it differs from the `Capture it:` line of `IMAGES.md` |

It writes the card as `docs/images/02-library-search.png` and adds the row, or replaces the row
for the same file, with status `placeholder: new picture`. Line breaks and runs of spaces in the
text become single spaces, so each row stays on one line. The figure in the chapter does not
change: the card stands where the picture will go.

**A card never reaches a release.** The check fails while a row says `placeholder`; `--draft` only
warns.

## Stale pictures

A picture is stale when its screen's layout, controls, labels or columns changed. Colour or font
drift alone is not stale.

- **Find what a change touches through `IMAGES.md`**, by section id and by what each row shows,
  not by guessing from file names.
- **Retake a stale picture, or turn it into a card** by running the script on the same `--file`
  with `--why "stale: <what changed>"`:

  ```bash
  quarto run <skill>/scripts/placeholder-card.ts --docs docs --file 02-library-search.png \
    --section sec-library-search --shows "The Library list narrowed by Filter" \
    --how "Open Sample Viewer, choose Library, type tile in Filter" \
    --why "stale: Search was renamed Filter"
  ```

- **Only for a picture that is stale.** The script overwrites a `captured` picture and its row
  without asking; the old screenshot then survives only in git.

## Report the waiting cards

At the end of a pass, list every card still waiting, with what it shows and how to reach it, so
the owner can take them in one sitting:

```text
Cards waiting (2):
- 02-library-search.png (sec-library-search): The Library list narrowed by Search.
  Open Sample Viewer, choose Library, type tile in Search.
- 90-settings.png (sec-settings): The settings window. Choose Settings in the menu bar.
Take each with the Capture it line in docs/images/IMAGES.md, save it over the card,
and change its Status to captured.
```
