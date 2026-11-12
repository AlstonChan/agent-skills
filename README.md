# agent-skills

Agent skills for Claude Code and other tools that read the Agent Skills format.

| Skill | What it does |
| --- | --- |
| [`component-knowledge-base`](skills/component-knowledge-base/SKILL.md) | Builds a `docs/` knowledge base for one component folder — its why, history, flows and known issues — from the code, the git history and an interview with the owner. |
| [`wpf-design-system`](skills/wpf-design-system/SKILL.md) | Conventions for standardizing WPF/XAML styling into a design system: token naming, implicit vs keyed styles, ResourceDictionary layout and merge order, consolidating inline styles. |
| [`user-guide`](skills/user-guide/SKILL.md) | Writes and maintains a Quarto PDF user guide for a desktop app's end users, with every fact taken from the code and standard screenshot placeholders until a picture is taken. |

## Install

As Claude Code plugins — each skill is its own plugin, so install only the ones you want:

```text
/plugin marketplace add AlstonChan/agent-skills
/plugin install component-knowledge-base@alstonchan
/plugin install wpf-design-system@alstonchan
/plugin install user-guide@alstonchan
```

With [skills.sh](https://skills.sh) — for Claude Code and the other agents it supports (needs
Node.js 22.20 or later):

```text
npx skills add AlstonChan/agent-skills --skill component-knowledge-base
npx skills add AlstonChan/agent-skills --skill wpf-design-system -a claude-code -g
npx skills add AlstonChan/agent-skills --skill user-guide -a claude-code -g
```

The `user-guide` skill needs [Quarto](https://quarto.org) 1.6 or later installed, since its scripts run with `quarto run`.

Skills install into the current project by default; `-g` installs them for every project and
`-a` picks the agent instead of being asked.

Manually: copy `skills/<name>/` into `~/.claude/skills/`, or into the skills directory of any
other tool that supports the format.

## License

[MIT](LICENSE)
