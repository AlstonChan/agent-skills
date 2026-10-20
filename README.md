# agent-skills

Agent skills for Claude Code and other tools that read the Agent Skills format.

| Skill | What it does |
| --- | --- |
| [`component-knowledge-base`](skills/component-knowledge-base/SKILL.md) | Builds a `docs/` knowledge base for one component folder — its why, history, flows and known issues — from the code, the git history and an interview with the owner. |
| [`wpf-design-system`](skills/wpf-design-system/SKILL.md) | Conventions for standardizing WPF/XAML styling into a design system: token naming, implicit vs keyed styles, ResourceDictionary layout and merge order, consolidating inline styles. |

## Install

As a Claude Code plugin:

```text
/plugin marketplace add AlstonChan/agent-skills
/plugin install agent-skills@alstonchan
```

The skills are then available as `agent-skills:<name>`.

Manually: copy `skills/<name>/` into `~/.claude/skills/`, or into the skills directory of any
other tool that supports the format.

## License

[MIT](LICENSE)
