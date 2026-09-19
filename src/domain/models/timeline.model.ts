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
    uid: string;
    calendar: string;
    summary: string;
    starts_at: string;
    ends_at: string;
}

// What an event is written back as. The times are wall clock, so they are handed to
// AppleScript as their own components rather than as a formatted string a locale
// could read differently.
export interface CalendarEventDraft {
    // Left out when the write is not about the title: a record dragged to another
    // time keeps whatever it was called, including having been called nothing.
    summary?: string;
    start: Date;
    end: Date;
}

// Enough to find one event again in Apple Calendar. `uid` is what the row carried;
// `summary` and `start` are the stored values, kept for the lookup that runs when a
// calendar hands back no uid to match.
export interface CalendarEventIdentity {
    calendar: string;
    uid: string;
    summary: string;
    start: Date;
}

// What a record with no title of its own is called on screen. Named here so the
// editor can leave the title empty rather than writing the placeholder into the
// calendar as if it were a real title.
export const UNTITLED_EVENT = '제목 없음';

export type TimelineItemType = 'home' | 'move' | 'work' | 'place' | 'focus' | 'plan';

// One record placed on a day. `start` and `end` are the wall clock; `visualStart`
// and `visualEnd` are the same instants as hours of the day, which is what the
// grid positions against. `column` and `columns` come from the overlap layout.
export interface TimelineItem {
    uid: string;
    name: string;
    calendar: string;
    start: Date;
    end: Date;
    visualStart: number;
    visualEnd: number;
    type: TimelineItemType;
    active: boolean;
    // True when the record reaches outside the day it is drawn on. Its `start` and
    // `end` are then the day's edges rather than the event's own, which is why an
    // editor must not offer to write those times back.
    clipped: boolean;
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

// The reverse: an hour of the day back to a moment on that date. Minutes are added to
// midnight rather than set as an hour and a minute, so 24 lands on the next midnight
// and a day that is not 24 hours long still resolves through the calendar's own
// arithmetic.
// A time field's "HH:mm" as an hour of the day. Null when the field is empty or
// holds something that is not a time, so the caller keeps whatever it had rather
// than writing a NaN date into a calendar.
export function parseClock(value: string): number | null {
    const parts = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    const hours = parts ? Number(parts[1]) : NaN;
    const minutes = parts ? Number(parts[2]) : NaN;

    if (!parts || hours > 24 || minutes > 59) {
        return null;
    }

    return hours + minutes / 60;
}

// A date field's "yyyy-MM-dd" as the day it names. Built from the parts rather than
// parsed, because Date reads a bare date string as UTC and would land on the day
// before west of Greenwich. Null when the field holds a day that does not exist, so
// the caller keeps the day it had.
export function parseDay(value: string): Date | null {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

    if (!parts) {
        return null;
    }

    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }

    return date;
}

export function atHour(date: Date, hour: number): Date {
    const moment = new Date(date);

    moment.setHours(0, 0, 0, 0);
    moment.setMinutes(Math.round(hour * 60));

    return moment;
}
