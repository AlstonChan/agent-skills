---
name: component-knowledge-base
description: 'Build the docs/ knowledge base for one component folder - its why, history, flows and known issues - inside that module''s own folder (src/auth/docs/, never one shared src/docs/), from the code, the git history and an interview with the owner. Use when asked to document a folder, start a docs/ folder, or "write down the why" for a module. Maintenance of an existing docs/ folder follows references/rules.md, which belongs in the repository''s CLAUDE.md or AGENTS.md so it applies on every change.'
---

# Component knowledge base

Builds a `docs/` folder inside one module's own folder, for that module only. The rules the result
must obey are in [references/rules.md](references/rules.md); this skill is the procedure for
getting there. If the repository's `CLAUDE.md` or `AGENTS.md` does not carry those rules yet, offer
to add them so later changes keep the docs current.

## Where docs/ goes

Each module keeps its knowledge next to its code. A shared folder at the root of `src/` is never
the place:

```text
src/
├── auth/
│   ├── docs/              ← auth's knowledge, and only auth's
│   │   ├── overview.md
│   │   └── decisions.md
│   ├── token-service.ts
│   └── session.ts
├── accounts/
│   ├── docs/              ← accounts' knowledge; links down to ../../auth/docs/
│   │   └── overview.md
│   └── account-service.ts
├── shared/                ← no docs/: only helpers, owns no knowledge
└── docs/                  ✗ never: one folder describing every module
```

- **Pick the smallest folder that owns the knowledge** — the module whose code you would change if
  the fact changed. A submodule gets its own `docs/` (`src/auth/oauth/docs/`) only when it owns
  knowledge its parent does not; otherwise its facts go in the parent's `src/auth/docs/`.
- **Asked to document a parent folder** ("document `src/`"): treat it as a list of modules. Run
  step 1 on each child, then build one `docs/` per qualifying module, one module at a time, each
  with its own interview. Do not create `src/docs/`.
- **Knowledge that spans modules** goes in the lowest module that owns it; the others link down to
  it. What is truly system-wide — layering, how the modules fit together — belongs in the
  repository's architecture doc, not in a `docs/` under `src/`.

## 1. Decide whether the folder earns a docs/ folder

It does only if it owns knowledge: a decision, a non-obvious flow or a deliberate non-fix.
The domain layer holds rules and formats; orchestration holds end-to-end flows; UI folders hold
only real contracts and traps. User-facing behaviour goes in the user guide, if there is one. A
consumer folder that only calls a lower layer gets a short overview that links down.

## 2. Gather, read-only

- Every source file in the folder and its tests. Tests often hold the only statement of an
  invariant.
- `git log --follow --format='%h %ad %s' --date=short -- <file>` for each file. Folders created by
  moves start too late in a plain `git log -- <folder>`. Read the bodies of commits that have one;
  many older commits carry a subject only.
- Search older commits for removed shapes (`git log -S'<identifier>'`) — a legacy branch in the
  code usually has an even older ancestor that explains it.
- Architecture docs, the user guide and any agent memory or notes for facts about this folder.
  Notes are point-in-time: verify every type name against the code.

**Do not infer facts about the outside world from identifiers.** A reader named after a machine
may read a file that a different machine writes; a CSV that looks like a customer format may be a
downstream report. Who produces a file, who reads it and who set its format are interview
questions, not code-reading conclusions.

## 3. Interview the owner once

Send one consolidated, numbered list. Ask only what the code and history cannot answer:

- missing reasons behind a decision;
- deliberate or bug, for anything that looks wrong;
- external rules — machine, upstream, customer, downstream reader;
- rejected alternatives;
- will fix, won't fix, or planned removal.

Make every question concrete: quote the real path, id or row, and say what the code does with it.
Abstract questions tend to come back "don't understand". Prefer a yes/no shape, explain any term
the owner may not use, and say what you will write for each answer. Unanswered items are written
as `Unconfirmed`, never as fact. Expect corrections in later rounds; apply them everywhere the
wrong fact spread (overview, decisions, flows, the consumer's docs).

## 4. Write

Start from the templates in `templates/`. Only `overview.md` is required; create the others only
when they have content.

- Every rule about a path, a file name or an id gets a **worked example** with real values.
- A decision says what was decided, why and what was rejected, with the commit hash that carries
  the change.
- History is from git, with dates and hashes. When a format or layout changed shape several
  times, use a table: when, commit, what it looked like.
- Known issues are grouped Bugs / Accepted / Planned / Watch / Small; an entry is removed in the
  commit that fixes it.
- A trap where the code's own naming misleads goes in the overview, with a known-issues entry.
- Links follow the dependencies. A lower layer never lists its consumers.

## 5. Register and render

Skip this step if the repository does not build a docs site.

- Add the folder to the site's table of contents or nav (DocFX `toc.yml`, MkDocs `nav`,
  Docusaurus sidebar, …) with a path relative to that file — one entry per module, e.g. in a
  `docs/toc.yml` at the repository root:

  ```yaml
  - name: Components
    items:
      - name: Auth
        href: ../src/auth/docs/overview.md
      - name: Accounts
        href: ../src/accounts/docs/overview.md
  ```
- Build the site. The component pages must add no warnings. Common causes:
  - a link to a folder (`[docs/](docs/)`) — most generators need a page;
  - a link from a file mapped in from outside the site's content root into it — it does not
    resolve; use plain text;
  - an anchor that no longer exists after a heading was renamed — grep `decisions.md#`.
- Serve the site locally and look at the result.

## 6. Migrate notes

If you keep agent memory or notes about this folder: for each note whose fact is now in the docs,
delete it, or trim it to what the docs do not hold (cross-component traps, how-tos for other
folders), keeping the file name when other notes link to it. Update any index and check every
entry still points at a file.

## 7. Commit

Stage only the docs, the table of contents and anything this work changed. `docs(<scope>): ...`,
in the repository's language, no attribution trailer.
