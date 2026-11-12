# Sourcing facts

Where every sentence in the guide comes from. The guide holds only what the code shows or the
owner confirmed; everything else waits in `docs/OPEN-QUESTIONS.md`.

## The code first

Read the source, never a guess at what a screen probably says. Whatever the stack, each kind of
fact has a home:

| Fact | Where it lives |
| :--- | :--- |
| Labels, titles, button text | The view's markup or code, and the string or resource tables it reads (one per language) |
| Menus and commands | The menu or toolbar definition, and the handler each item runs |
| Settings and defaults | The settings class or schema, and the value used when nothing is saved |
| Permissions | The role or permission checks that hide, disable or refuse a control |
| Messages | Every message box, dialog, notification and inline error, with its title and text |
| Navigation | The chain from a click to the window it opens |

- **Quote the text the user reads, in the guide's language.** Resolve a resource key to its
  string: Sample Viewer's `Library_SearchBox` is the label **Search**. In a formatted message,
  name each variable part in words: `"{0} items deleted"` is quoted with "number" where `{0}`
  stands (the message index shows how: [writing.md](writing.md)).
- **Trace how a screen is reached** from the code, so each "how to get there" step is real: the
  **Library** menu item runs a handler that opens the Library panel; its **Export** button opens
  the export dialog only when an item is selected. The steps say so.
- **Find the conditions.** A control hidden by a role, disabled until a selection exists, or shown
  only when a setting is on is described with its condition: "**Delete** is there only for
  administrators."
- **A default is what the code uses when nothing is saved**, not the value in a developer's
  config file.
- **Internal names stay in the notes, never in the guide.** A class, handler or resource key name
  helps you find a fact; the guide says what the user sees.

## Git history, for a user-facing why

Use history only where a reason helps a user act: why a confirmation appears, why an option moved.

```bash
git log -S'Confirm before deleting' --format='%h %ad %s' --date=short
git log --follow --format='%h %ad %s' --date=short -- <view file>
```

A reason the history does not state is an interview question, not a sentence in the guide.

## Agent memory, as leads only

Recall what memory holds about the app, but treat each item as a lead: verify it in the code, or
ask the owner. A reason recalled from memory becomes a question to confirm. Do not infer who uses a
screen, or what for, from its identifiers.

## The interview

Ask once, in one numbered list, only what the code and history cannot answer:

- **Who the users are**: their roles, how much they know, which of them uses which screen.
- **The task behind each screen**: what the user is trying to get done when they open it.
- **The users' words**: what they call things, where it differs from the labels. These feed the
  terms appendix.
- **Which messages matter**: the ones users actually meet, and what they should do about each.
- **Anything that looks like a bug**: deliberate, or a bug? Say what the guide would write either
  way.
- **The guide's language**, when the app shows more than one.

Make every question concrete: quote the label, the menu path or the message, say what the code
does, and prefer a yes/no shape. Say what you will write for each answer:

```text
3. The Library's Delete button asks "Remove this item?" and then deletes it with no undo
   (LibraryPanel, delete handler). Is that deliberate?
   Yes: the guide warns that removing cannot be undone.
   No: the step is left out until it is fixed.
```

Expect corrections in later rounds; apply each everywhere the wrong fact spread.

## OPEN-QUESTIONS.md

An unanswered item is left out of the guide entirely, not guessed and not marked. It goes in
`docs/OPEN-QUESTIONS.md`, which is never rendered, under `## Open`, as one numbered item: the
question, where it came from, and what will be written for each answer.

```text
## Open

1. Does the Library's Export button need a selected item, or does it export the whole list
   when nothing is selected?
   From: the export handler in the Library panel calls ExportAll when the selection is empty,
   but the button is disabled with no selection.
   Answer "needs a selection": sec-library-export says to select the items first.
   Answer "exports everything": sec-library-export gets a second task, "Export the whole list".
```

When an answer arrives, write it into its chapter and delete the item. When the list is empty,
put back `None yet.`
