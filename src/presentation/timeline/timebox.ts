import {HourRange, TimelineDay, TimelineItem} from 'src/domain/models/timeline.model';

// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// src/timebox.js, MIT licensed, Copyright (c) 2026 김경탁.
//
// Screen geometry for the time-box grid. An hour is a row; inside a column's cell on
// that row, left to right is the sixty minutes of the hour. Dates are already
// resolved by the time anything here runs, so this file never touches a Date.
//
// Positions come from hourValue hours, not elapsed milliseconds, so a day is never
// assumed to be 86,400 seconds. On the 23-hour spring-forward day the hour that does
// not exist simply has no row content, and on the 25-hour day the repeated hour lands
// twice and separates through the overlap bands.

// A one-minute record is 1.7% of its cell. Too thin to see or hit, so a piece is
// floored — CSS carries a pixel floor for the same reason.
export const MIN_PIECE_PERCENT = 3;

export type TimelineLane = 'location' | 'focus';

export interface HourPiece {
    left: number;
    width: number;
    continued: boolean;
    continues: boolean;
}

export interface BandPlan {
    locations: number;
    focus: number;
    bands: number;
}

// The part of one item that falls inside one hour, as a percentage across that
// hour's cell. Returns null when the item does not reach the hour at all.
//
// `continued` and `continues` say the item began before this row or runs past it,
// which is what lets a long record read as one stretch across several rows without a
// row pretending it starts or ends there.
export function hourPiece(item: TimelineItem, hour: number, rangeStart?: number): HourPiece | null {
    const from = Math.max(item.visualStart, hour);
    const to = Math.min(item.visualEnd, hour + 1);

    if (to <= from) {
        return null;
    }

    // Continued means "already drawn on an earlier row of this window", not "started
    // earlier in the day" — otherwise a record reaching in from before the window is
    // continued on every row it has and never gets its name.
    const firstDrawn = Math.max(item.visualStart, rangeStart === undefined ? item.visualStart : rangeStart);
    const left = (from - hour) * 100;
    const width = Math.max(MIN_PIECE_PERCENT, (to - from) * 100);

    return <HourPiece>{
        left: left,
        // A piece at the end of the hour would otherwise run past the cell.
        width: Math.min(width, 100 - left),
        continued: firstDrawn < from,
        continues: item.visualEnd > to,
    };
}

// Which hours get a row. The window is whole hours, so the last row is the hour
// before the end: a 06–24 window is eighteen rows, 06 through 23.
export function hourRows(range: HourRange): number[] {
    const hours: number[] = [];

    for (let hour = Math.floor(range.start); hour < range.end; hour++) {
        hours.push(hour);
    }

    return hours;
}

// How many overlap bands a set of items needs. layoutOverlaps has already assigned
// each item a column, so the deepest column in use is the answer — and it is read
// rather than recounted, so the view and the model cannot disagree.
export function bandCount(items: TimelineItem[], range: HourRange): number {
    return (items || []).reduce((most, item) => {
        if (item.visualEnd <= range.start || item.visualStart >= range.end) {
            return most;
        }

        return Math.max(most, (item.column || 0) + 1);
    }, 0);
}

// The bands one row carries, and therefore every row's height: locations above,
// focus below, counted across every day on screen so the same band sits at the same
// height in every column.
//
// ponytail: one dense day makes every row that tall; measure per row if a busy day ever looks too airy.
export function bandPlan(days: TimelineDay[], range: HourRange): BandPlan {
    let locations = 0;
    let focus = 0;

    (days || []).forEach((day) => {
        locations = Math.max(locations, bandCount(day.locations, range));
        focus = Math.max(focus, bandCount(day.actions, range));
    });

    // A row still needs somewhere to draw, and plan mode has no locations at all.
    if (!locations && !focus) {
        focus = 1;
    }

    return <BandPlan>{locations: locations, focus: focus, bands: locations + focus};
}

// Where one item's band sits inside a row, in band slots from the row's top.
export function bandIndex(plan: BandPlan, lane: TimelineLane, column: number): number {
    return (lane === 'focus' ? plan.locations : 0) + (column || 0);
}
