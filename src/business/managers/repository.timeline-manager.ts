import {addDays, isSameDay} from 'date-fns';
import {TimelineManager} from 'src/business/contracts/timeline.manager';
import {CalendarEventRepository} from 'src/infrastructure/contracts/calendar-event-repository';
import {
    CalendarEventRow,
    DAY_END,
    DAY_START,
    hourValue,
    TimelineDay,
    TimelineItem,
    TimelineItemType,
    TimelineMode,
} from 'src/domain/models/timeline.model';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';

// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// src/model.js, MIT licensed, Copyright (c) 2026 김경탁. The stay merging, the
// open-stay extension and the overlap lane assignment are unchanged; the week of
// seven days became a run of `dayCount` days so a single day can be asked for.

const STAY_MERGE_GAP_IN_MS = 120000;

interface TimelineEvent {
    calendar: string;
    name: string;
    start: Date;
    end: Date;
    active: boolean;
}

// Rows come straight from the database, so a null or non-string date becomes an
// Invalid Date rather than throwing.
export function parseLocal(value: string): Date {
    return new Date(typeof value === 'string' ? value.replace(' ', 'T') : NaN);
}

// Each place name is a comma-separated list, so 집 and 우리집 can both be home. The
// stored value is settings somebody can have edited, so a non-string matches nothing
// rather than throwing; an empty alias matches nothing either, which keeps a
// trailing comma from catching every untitled event.
export function locationType(name: string, settings: TimelineSettings): TimelineItemType {
    const matches = (value: string): boolean => typeof value === 'string'
        && value.split(',').some((alias) => alias.trim().length > 0 && alias.trim() === name);

    if (matches(settings.homeName)) {
        return 'home';
    }
    if (matches(settings.moveName)) {
        return 'move';
    }
    if (matches(settings.workName)) {
        return 'work';
    }

    return 'place';
}

export function mergeLocations(items: TimelineItem[]): TimelineItem[] {
    const merged: TimelineItem[] = [];
    items.sort((a, b) => a.start.getTime() - b.start.getTime());

    items.forEach((item) => {
        const previous = merged[merged.length - 1];
        const gap = previous ? item.start.getTime() - previous.end.getTime() : Infinity;

        if (previous && previous.name === item.name && gap >= 0 && gap <= STAY_MERGE_GAP_IN_MS) {
            if (item.end > previous.end) {
                previous.end = item.end;
            }
            if (item.visualEnd > previous.visualEnd) {
                previous.visualEnd = item.visualEnd;
            }
            previous.active = previous.active || item.active;
            return;
        }

        merged.push(item);
    });

    return merged;
}

// Assigns each item a lane (column of columns) so overlapping events sit side by
// side instead of hiding one another.
export function layoutOverlaps(items: TimelineItem[]): TimelineItem[] {
    items.sort((a, b) => a.visualStart - b.visualStart || b.visualEnd - a.visualEnd);

    let group: TimelineItem[] = [];
    let ends: number[] = [];
    let groupEnd = -Infinity;

    const finishGroup = (): void => {
        group.forEach((item) => {
            item.columns = ends.length;
        });
        group = [];
        ends = [];
    };

    // ponytail: linear lane search is quadratic for a fully overlapping day; use a heap if dense imports become slow.
    items.forEach((item) => {
        if (item.visualStart >= groupEnd) {
            finishGroup();
        }

        let column = ends.findIndex((end) => end <= item.visualStart);
        if (column === -1) {
            column = ends.length;
        }

        ends[column] = item.visualEnd;
        item.column = column;
        group.push(item);
        groupEnd = Math.max(groupEnd, item.visualEnd);
    });

    finishGroup();
    return items;
}

// `now` is injectable so the open-stay boundaries stay checkable.
export function prepareDays(
    rows: CalendarEventRow[],
    start: Date,
    dayCount: number,
    mode: TimelineMode,
    settings: TimelineSettings,
    now?: Date,
): TimelineDay[] {
    const activeNow = now ? new Date(now) : new Date();
    const events: TimelineEvent[] = rows.map((row) => <TimelineEvent>{
        calendar: row.calendar,
        name: row.summary || '제목 없음',
        start: parseLocal(row.starts_at),
        end: parseLocal(row.ends_at),
        active: false,
    }).filter((event) => Number.isFinite(+event.start) && Number.isFinite(+event.end));

    const locations = mode === TimelineMode.Actual ? events
        .filter((event) => event.calendar === settings.locationCalendar)
        .sort((a, b) => a.start.getTime() - b.start.getTime()) : [];
    const latest = locations[locations.length - 1];

    // An open stay is stored with no end time. The query carries in the newest
    // location row regardless of range, so extending it to now also covers a stay
    // that began yesterday or in an earlier week. Any row that a newer one follows
    // is not the latest and keeps its recorded end.
    if (latest && latest.end.getTime() === latest.start.getTime() && latest.start <= activeNow) {
        latest.end = activeNow;
        latest.active = true;
    }

    const days: TimelineDay[] = [];

    for (let index = 0; index < dayCount; index++) {
        const dayStart = addDays(start, index);
        const dayEnd = addDays(dayStart, 1);
        const dayLocations: TimelineItem[] = [];
        const dayActions: TimelineItem[] = [];

        events.forEach((event) => {
            if (event.end <= event.start || event.start >= dayEnd || event.end <= dayStart) {
                return;
            }

            const clippedStart = event.start < dayStart ? dayStart : event.start;
            const clippedEnd = event.end > dayEnd ? dayEnd : event.end;
            // Clipped to the whole day, not to the visible window: the window is a
            // view concern.
            const visualStart = Math.max(DAY_START, hourValue(clippedStart));
            const visualEnd = Math.min(DAY_END, clippedEnd >= dayEnd ? DAY_END : hourValue(clippedEnd));

            if (visualEnd <= visualStart) {
                return;
            }

            const item = <TimelineItem>{
                name: event.name,
                calendar: event.calendar,
                start: clippedStart,
                end: clippedEnd,
                visualStart: visualStart,
                visualEnd: visualEnd,
                type: mode === TimelineMode.Plan ? 'plan'
                    : event.calendar === settings.focusCalendar ? 'focus'
                        : locationType(event.name, settings),
                active: event.active,
                column: 0,
                columns: 1,
            };

            if (mode === TimelineMode.Plan || event.calendar === settings.focusCalendar) {
                dayActions.push(item);
            } else {
                dayLocations.push(item);
            }
        });

        days.push(<TimelineDay>{
            date: dayStart,
            today: isSameDay(dayStart, activeNow),
            future: mode === TimelineMode.Actual && dayStart > activeNow,
            locations: layoutOverlaps(mergeLocations(dayLocations)),
            actions: layoutOverlaps(dayActions),
        });
    }

    return days;
}

export class RepositoryTimelineManager implements TimelineManager {
    constructor(
        private readonly calendarEventRepository: CalendarEventRepository,
    ) {

    }

    public isSupported(): boolean {
        return this.calendarEventRepository.isSupported();
    }

    public async getDay(date: Date, mode: TimelineMode, settings: TimelineSettings): Promise<TimelineDay> {
        const rows = await this.calendarEventRepository.getEventsForDay(date, mode, settings);
        return prepareDays(rows, date, 1, mode, settings)[0];
    }
}
