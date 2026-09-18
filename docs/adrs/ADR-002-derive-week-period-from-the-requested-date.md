# ADR-002: Derive a week's month, quarter and year from the requested date

**Date:** 2026-09-18
**Status:** Accepted (Implemented)

## Context

`DateFnsDateRepository.getWeekFromDate(startOfWeekDay, standard, date)` builds a `Week`
for the week that contains `date`. It first normalises the input:

```typescript
const firstDayOfWeek = startOfWeek(date, {weekStartsOn: startOfWeekDay});
```

and then derived *every* field from `firstDayOfWeek`, including the three period fields
that are not about the week itself:

```typescript
const month = this.getMonth(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth());
const quarter = this.getQuarter(month);
const year = this.getYear(firstDayOfWeek.getFullYear());
```

`firstDayOfWeek` and `date` fall in different months whenever a week straddles a month
boundary, and then `week.month`, `week.quarter` and `week.year` describe the *previous*
month, quarter or year.

**Problem:**

Every caller passes the day it actually means, and then reads those three fields back as
"the month/quarter/year of that day":

- `OpenMonthlyNoteCommandHandler`, `OpenQuarterlyNoteCommandHandler` and
  `OpenYearlyNoteCommandHandler` call `getWeek(today, …)` and open `week.month`,
  `week.quarter` and `week.year`.
- `DefaultCalendarService.getMonthForWeeks()` (and its quarter/year siblings) look up the
  week that contains `today` precisely so that they can return that day's period, then
  return `currentWeek.month`.

On a monday-based week, asking for Sunday 2023-01-01 produced:

| | Before | Expected |
|---|---|---|
| Calendar header | `December 2022`, `Q4` | `January 2023`, `Q1` |
| *Open monthly note* | December 2022 | January 2023 |
| *Open yearly note* | 2022 | 2023 |

This is not cosmetic: the commands create and open the wrong periodic note file.

## Decision

Derive `month`, `quarter` and `year` from `date` — the date the caller asked about —
rather than from `firstDayOfWeek`.

```typescript
const month = this.getMonth(date.getFullYear(), date.getMonth());
const quarter = this.getQuarter(month);
const year = this.getYear(date.getFullYear());
```

**`Week.date` and `Week.days` keep using `firstDayOfWeek`** and are deliberately left
alone.

## Rationale

### Why fix it in the repository rather than in each caller

All four call sites want the same thing and all four are wrong in the same way, so a
single change where they converge is both the smaller diff and the complete fix. Fixing
them individually would leave the next caller to rediscover the trap.

### Why `Week.date` must stay the first day of the week

`Week.date` is not a display value. It is the date that

- `PeriodNameBuilder` formats into the weekly note's file name and folder path, so moving
  it off the start of the week would give the same week different file names depending on
  which day the week was built from;
- `getNextWeek()`/`getPreviousWeek()` step forward and backward from;
- `RepositoryDateManager.getWeeksForMonth()` and `DefaultCalendarService.sortWeeks()` use
  as the week's sort key and month-navigation anchor.

Only the three period fields were ambiguous; the week's own identity was not.

### Alternatives considered

**A. Also set `Week.date` to the requested date**
- Pros: makes the whole object describe one date
- Cons: silently renames users' weekly notes and destabilises week navigation and sorting;
  it answers a question (`what is this week?`) that was never wrong

**B. Add `getMonthFromDate` to the `DateManager` contract and fix the four callers**
- Pros: leaves `Week.month` meaning "the month the week starts in"
- Cons: four changes instead of one, a wider contract, and `Week.month` would then have no
  remaining consumer

## Consequences

### Positive:
- The calendar header, and the *open monthly/quarterly/yearly note* commands, follow the
  selected day across month, quarter and year boundaries
- Weekly note names, week navigation and week sorting are untouched

### Neutral:
- For weeks reached by navigation the reference date *is* the first day of the week, so
  their month, quarter and year are unchanged
- Within a single month the two dates agree, so the common case has no observable change

### Negative:
- `Week.month` now depends on which day the week was built from. Two `Week` objects for the
  same calendar week can report different months if they were built from different days.
  This is accepted: every caller builds a week from the day it cares about.

## Affected Components

- [src/infrastructure/repositories/date-fns.date-repository.ts](../../src/infrastructure/repositories/date-fns.date-repository.ts) (`getWeekFromDate`)
- [src/infrastructure/repositories/date-fns.date-repository.spec.ts](../../src/infrastructure/repositories/date-fns.date-repository.spec.ts) (`getWeekFromDate across a month boundary`)

## References

- Consumers: [open-monthly-note.command-handler.ts](../../src/presentation/command-handlers/open-monthly-note.command-handler.ts), [open-quarterly-note.command-handler.ts](../../src/presentation/command-handlers/open-quarterly-note.command-handler.ts), [open-yearly-note.command-handler.ts](../../src/presentation/command-handlers/open-yearly-note.command-handler.ts), [default.calendar-service.ts](../../src/presentation/services/default.calendar-service.ts)
- Weekly note naming: [period.name-builder.ts](../../src/business/builders/period.name-builder.ts)
