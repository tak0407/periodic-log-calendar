import {Settings} from 'src/domain/settings/settings';
import {DAY_END, DAY_START, HourRange} from 'src/domain/models/timeline.model';

// Which Apple Calendar calendars the log and plan tab reads, and the window of the
// day it draws. Calendar titles are plain text because that is what Apple Calendar
// stores; they reach a query quoted as SQL literals, never concatenated raw.
//
// Each place name is a comma-separated list, so 집 and 우리집 can both be home.
export interface TimelineSettings extends Settings {
    locationCalendar: string;
    focusCalendar: string;
    planCalendars: string;
    homeName: string;
    moveName: string;
    workName: string;
    dayStart: number;
    dayEnd: number;
}

export const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
    locationCalendar: '단축어 기록',
    focusCalendar: '단축어 세부',
    planCalendars: '내 계획, 약속·확정 일정',
    homeName: '집',
    moveName: '이동',
    workName: '회사',
    dayStart: 6,
    dayEnd: 24,
};

// Calendar titles arrive from stored settings, so blanks, duplicates and
// non-strings are dropped before they reach a query.
export function planCalendars(settings: TimelineSettings): string[] {
    const titles: string[] = [];

    (typeof settings.planCalendars === 'string' ? settings.planCalendars.split(',') : [])
        .forEach((title) => {
            const trimmed = title.trim();

            if (trimmed && !titles.includes(trimmed)) {
                titles.push(trimmed);
            }
        });

    return titles;
}

export function logCalendars(settings: TimelineSettings): string[] {
    return [settings.locationCalendar, settings.focusCalendar];
}

// A stored hour can be anything the settings field accepted, so it is pinned to a
// whole hour inside the day before it can reach a layout calculation.
function normalizeHour(value: number, fallback: number): number {
    const hour = Math.round(Number(value));

    if (!Number.isFinite(hour)) {
        return fallback;
    }

    return Math.min(DAY_END, Math.max(DAY_START, hour));
}

// The visible window needs at least one hour in it, so an end at or below the
// start falls back to the default span rather than collapsing the grid.
export function viewRange(settings: TimelineSettings): HourRange {
    const start = normalizeHour(settings.dayStart, DEFAULT_TIMELINE_SETTINGS.dayStart);
    const end = normalizeHour(settings.dayEnd, DEFAULT_TIMELINE_SETTINGS.dayEnd);

    if (end > start) {
        return {start: start, end: end};
    }

    return {start: DEFAULT_TIMELINE_SETTINGS.dayStart, end: DEFAULT_TIMELINE_SETTINGS.dayEnd};
}
