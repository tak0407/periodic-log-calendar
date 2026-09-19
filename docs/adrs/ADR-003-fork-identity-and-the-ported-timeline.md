# ADR-003: Fork identity, and where the ported timeline lives

**Date:** 2026-09-18
**Status:** Accepted (Implemented)

## Context

This repository is a fork of [Daily note calendar](https://github.com/bartkessels/daily-note-calendar)
by Bart Kessels. Two things had to be decided at once: how the fork identifies itself so
that it can live beside the original, and where code ported from a second project fits in
the layering this repository already has.

The ported code comes from [weekly-log-viewer](https://github.com/tak0407/weekly-log-viewer)
`1.4.0`, which is MIT licensed. MIT is compatible with the GPL-3.0 in this direction, so
the ported files carry their original notice and this repository stays GPL-3.0.

## Decision

### 1. The fork gets its own identity

| | Value | Why |
|---|---|---|
| `manifest.json` `id` | `periodic-log-calendar` | Obsidian keys a plugin's folder and its enabled state by `id`. Sharing `daily-note-calendar` would mean the two could never be installed together. Checked against the community plugin list: free, while `periodic-calendar` is already taken. |
| `CalendarView.VIEW_TYPE` | `periodic-log-calendar` | A view type is registered per Obsidian session, so two enabled plugins registering `daily-note-calendar` would throw. This is as load-bearing as the plugin id and is easy to miss. |
| `isDesktopOnly` | `true` | The log tab runs `sqlite3` through `child_process`. Mobile has neither, so the plugin now stays out of the mobile plugin list rather than installing and failing. |
| `version` | restarts at `0.1.0` | Inheriting upstream's `2.8.0` makes it impossible to tell whose version a number is. A `0.x` track can never collide with upstream's numbering, and says plainly that this is a personal fork. `versions.json` is reset to match. |

GPL-3.0 section 5(a) requires a modified work to carry prominent notices that it was
changed and when. The README opens with what this is a fork of, who wrote the original,
and a table of what was changed; `manifest.json` names the original author in the field
Obsidian shows in the plugin list.

### 2. Ported code is split along the layers that already exist

| weekly-log-viewer 1.4.0 | Here | Layer |
|---|---|---|
| `src/calendar.js` (sqlite3 call) | `infrastructure/obsidian/obsidian.calendar-adapter.ts` | Raw I/O, like the other Obsidian adapters, and excluded from coverage for the same reason |
| `src/calendar.js` (SQL, validation) | `infrastructure/repositories/sqlite.calendar-event-repository.ts` | Everything testable without node |
| `src/model.js` (`prepareDays`) | `business/managers/repository.timeline-manager.ts` | Business rules over repository data |
| `src/timebox.js` | `presentation/timeline/timebox.ts` | Screen geometry, so it belongs with the view |
| `src/dates.js` | mostly dropped | `addDays` and date formatting come from `date-fns`, already a dependency. Only `hourValue` had no equivalent and moved to `domain/models/timeline.model.ts`. |
| `src/settings.js` | `domain/settings/timeline.settings.ts` | Follows the settings shape already here |

`src/render.js` and `src/dom.js` were not ported. They build DOM by hand; this repository
uses React, so the view was rewritten against the same geometry functions.

### 3. Upstream is tracked by adding files, not editing them

Upstream stays on the `upstream` remote and this fork expects to keep merging from it. So
everything the fork adds lives in new files, and the edits to files upstream also owns are
kept to the fewest lines that will do:

| File | Edit |
|---|---|
| `presentation/components/calendar.component.tsx` | One line: `NotesComponent` became `PeriodTabsComponent`, which renders `NotesComponent` itself |
| `domain/settings/plugin.settings.ts` | One field and its default |
| `infrastructure/contracts/settings-repository-factory.ts` | One enum member |
| `infrastructure/factories/default.settings-repository-factory.ts` | One `case` |
| `presentation/context/view-model.context.ts` | One member and one hook |
| `daily-note-calendar.plugin-setting-tab.ts` | One `push` |
| `daily-note-calendar.plugin.ts`, `dependencies.ts`, `views/calendar.view.tsx` | Wiring only |
| `styles.css` | Appended at the end |

A merge from upstream should then conflict only where upstream changed those same few
lines, plus the identity files (`manifest.json`, `package.json`, `versions.json`,
`README.md`), which will conflict on every release and are meant to be resolved in this
fork's favour.

## Rationale

### Alternatives considered

**Keeping upstream's plugin id and view type**
- Pros: nothing to change
- Cons: the two plugins could not be installed together, which is the whole reason this
  fork is separate; `registerView` would throw outright

**Continuing upstream's version numbering, e.g. 3.0.0**
- Pros: keeps the lineage visible in the number
- Cons: collides with upstream's own future releases, and the lineage belongs in the
  README where it can be explained

**Vendoring weekly-log-viewer as a dependency instead of porting**
- Pros: no duplicated code
- Cons: it is a plugin, not a library — it has no published package, its modules reach
  for Obsidian and the DOM, and its day view is not separable from its week view

**Porting `render.js` as-is**
- Pros: least thought
- Cons: hand-built DOM inside a React tree, with its own lifecycle; the geometry is the
  part worth keeping and it is already pure

## Consequences

### Positive:
- The fork installs beside the original, with its own settings and its own sidebar view
- The notes tab is the original view, untouched and still the default, so nothing anyone
  relied on changed
- The ported rules — stay merging, the open stay, the overlap lanes, the hour geometry —
  are pure functions under test, away from the node call that cannot be tested

### Negative:
- The identity files will conflict on every upstream merge. This is unavoidable and the
  resolution is always the same.
- `hourValue`, `parseLocal` and the settings normalizers are a second copy of logic that
  also lives in weekly-log-viewer. The two will drift; they are small, tested, and the
  alternative was a dependency that does not exist.

### Neutral:
- The log tab's user-facing text is Korean, following the issue this was built from and
  the calendars it reads. The rest of the plugin's interface stays English.

## Affected Components

- [manifest.json](../../manifest.json), [versions.json](../../versions.json), [package.json](../../package.json), [README.md](../../README.md)
- [src/domain/models/timeline.model.ts](../../src/domain/models/timeline.model.ts), [src/domain/settings/timeline.settings.ts](../../src/domain/settings/timeline.settings.ts)
- [src/infrastructure/obsidian/obsidian.calendar-adapter.ts](../../src/infrastructure/obsidian/obsidian.calendar-adapter.ts), [src/infrastructure/repositories/sqlite.calendar-event-repository.ts](../../src/infrastructure/repositories/sqlite.calendar-event-repository.ts)
- [src/business/managers/repository.timeline-manager.ts](../../src/business/managers/repository.timeline-manager.ts)
- [src/presentation/timeline/timebox.ts](../../src/presentation/timeline/timebox.ts), [src/presentation/components/period-tabs.component.tsx](../../src/presentation/components/period-tabs.component.tsx), [src/presentation/components/timeline.component.tsx](../../src/presentation/components/timeline.component.tsx)

## References

- Upstream: https://github.com/bartkessels/daily-note-calendar
- Ported from: https://github.com/tak0407/weekly-log-viewer at tag `1.4.0` (MIT, Copyright (c) 2026 김경탁)
- Manual QA for the adapter: [docs/manual-qa-checklist.md](../manual-qa-checklist.md)
