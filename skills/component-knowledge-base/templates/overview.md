# <Component>

<One paragraph: what this folder is for and where it sits. Say what it does not own if that is
easy to get wrong.>

<For a consumer folder, link down to the module it builds on, relative to this file. From
src/accounts/docs/overview.md:> Builds on [Auth](../../auth/docs/overview.md), which owns
<what>.

## What this folder owns

- **<Responsibility>.** `<Type.Member>` <does what>. See [flows](flows.md).

## Formats and rules it enforces

| Rule | Where |
|---|---|
| <A rule about a path, name or id, with a real example value.> | `<Type>` |

## Invariants that are easy to break

- **<Invariant>.** <What breaks if it is violated; the test that guards it, if any.>

## See also

- [Decisions](decisions.md) · [History](history.md) · [Known issues](known-issues.md)
