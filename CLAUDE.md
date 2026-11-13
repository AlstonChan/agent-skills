# agent-skills

Skills in `skills/<name>/`, each published as its own plugin by `.claude-plugin/marketplace.json`.

## Rules

- **A change under `skills/<name>/` bumps that plugin's `version` in `marketplace.json`** in the
  same push: patch for fixes and wording, minor for new behaviour, major for a breaking change.
  Claude Code offers an update only when the version changes; the `plugin-version` workflow
  fails otherwise.
- **A new skill** gets `skills/<name>/SKILL.md` whose `name` matches the folder, its own plugin
  entry in `marketplace.json`, and a row plus install lines in `README.md`.
- **Every example is invented**: Sample Viewer by Sample Co for `user-guide`, the `auth` and
  `billing` modules for `component-knowledge-base`. Never a real company, product, customer,
  person or internal path, in files or in commit messages. The `user-guide` skill also names no
  UI stack; its tests fail on `wpf`.
- **Run the tests before pushing a change to `skills/user-guide/` or `tests/user-guide/`**
  (about two minutes; a name fragment runs one file):

  ```bash
  quarto run tests/user-guide/run-tests.ts
  ```

- **The Quarto version is stated in four places**: `README.md`, `skills/user-guide/SKILL.md`,
  `skills/user-guide/references/setup.md` and `.github/workflows/test.yml`. Change them together.
- **The `user-guide` scripts run under `quarto run`** (Deno): Deno built-ins only, no npm or URL
  imports. Users copy `check-guide.ts` and `quarto.ts` into their own CI, so `check-guide.ts`
  imports nothing but `./quarto.ts`.
