// The clock bounds a day can span. The visible window is a user setting that sits
// inside these.
//
// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// MIT licensed, Copyright (c) 2026 김경탁. See README for the fork notice.

export const DAY_START = 0;
export const DAY_END = 24;

export enum TimelineMode {
    Actual = 'actual',
    Plan = 'plan'
}

// One row exactly as sqlite3 -json hands it back, before any parsing.
export interface CalendarEventRow {
    calendar: string;
    summary: string;
    starts_at: string;
    ends_at: string;
}

export type TimelineItemType = 'home' | 'move' | 'work' | 'place' | 'focus' | 'plan';

// One record placed on a day. `start` and `end` are the wall clock; `visualStart`
// and `visualEnd` are the same instants as hours of the day, which is what the
// grid positions against. `column` and `columns` come from the overlap layout.
export interface TimelineItem {
    name: string;
    calendar: string;
    start: Date;
    end: Date;
    visualStart: number;
    visualEnd: number;
    type: TimelineItemType;
    active: boolean;
    column: number;
    columns: number;
}

export interface TimelineDay {
    date: Date;
    today: boolean;
    future: boolean;
    locations: TimelineItem[];
    actions: TimelineItem[];
}

// A whole-hour window of the day, so the last row is the hour before `end`.
export interface HourRange {
    start: number;
    end: number;
}

// Where a moment sits on the clock, as hours of its own day. Read off the wall
// clock rather than from elapsed milliseconds, so a day is never assumed to be
// 86,400 seconds: on the 23-hour spring-forward day the hour that does not exist
// simply has no content, and on the 25-hour day the repeated hour lands twice and
// separates through the overlap bands.
export function hourValue(date: Date): number {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}
