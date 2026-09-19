import {addDays, format} from 'date-fns';
import {CalendarEventRepository} from 'src/infrastructure/contracts/calendar-event-repository';
import {CalendarAdapter} from 'src/infrastructure/adapters/calendar.adapter';
import {CalendarEventDraft, CalendarEventIdentity, CalendarEventRow, TimelineMode} from 'src/domain/models/timeline.model';
import {logCalendars, planCalendars, TimelineSettings} from 'src/domain/settings/timeline.settings';

// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// src/calendar.js, MIT licensed, Copyright (c) 2026 김경탁. The SQL, the validation
// and the open-stay union are unchanged; the week range became a single day.
//
// Reading is SQL against Apple Calendar's own database; writing is AppleScript handed
// to the Calendar app. A write must never go to the database: CalendarAgent owns it,
// and a row written behind its back is lost at the next sync, or takes the store's
// consistency with it.

export const NO_PLAN_CALENDAR = 'no-plan-calendar';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A date is built from its parts inside AppleScript rather than written out as text,
// because a date string is read against whatever the machine's locale is. The day is
// set to 1 first so that setting the month cannot overflow a month that is shorter
// than the day already standing there.
const MAKE_DATE_HANDLER =
    'on dncDate(y, m, d, secs)\n' +
    'set theDate to current date\n' +
    'set day of theDate to 1\n' +
    'set year of theDate to y\n' +
    'set month of theDate to m\n' +
    'set day of theDate to d\n' +
    'set time of theDate to secs\n' +
    'return theDate\n' +
    'end dncDate\n';

// Calendar names reach the query as text, so they are quoted as SQL literals rather
// than concatenated raw.
export function sqlLiteral(value: string): string {
    return '\'' + String(value).replace(/'/g, '\'\'') + '\'';
}

// A summary is whatever somebody typed into Calendar, so it reaches the script as a
// quoted literal. A line break would end the statement it sits in, so it becomes a
// space rather than being escaped.
export function appleScriptLiteral(value: string): string {
    return '"' + String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]+/g, ' ') + '"';
}

export function appleScriptDate(date: Date): string {
    const secondsOfDay = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return 'my dncDate(' + date.getFullYear() + ', ' + (date.getMonth() + 1) + ', ' +
        date.getDate() + ', ' + secondsOfDay + ')';
}

// Finds the event again inside a `tell calendar` block. The uid is what the row
// carried, and a calendar that hands back a different one still matches on what was
// stored, so an edit does not silently write nothing.
export function lookupScript(event: CalendarEventIdentity): string {
    return 'set dncMatches to (every event whose uid is ' + appleScriptLiteral(event.uid) + ')\n' +
        'if (count of dncMatches) is 0 then\n' +
        'set dncMatches to (every event whose summary is ' + appleScriptLiteral(event.summary) +
        ' and start date is ' + appleScriptDate(event.start) + ')\n' +
        'end if\n' +
        'if (count of dncMatches) is 0 then error "The event is no longer in the calendar."\n' +
        'set dncEvent to item 1 of dncMatches\n';
}

function sqlList(values: string[]): string {
    return values.map(sqlLiteral).join(', ');
}

// Actual mode reads the two log calendars; plan mode reads only the calendars picked
// in settings, so unrelated calendars stay out of the plan view.
export function calendarFilterSql(mode: TimelineMode, settings: TimelineSettings): string {
    const titles = mode === TimelineMode.Actual ? logCalendars(settings) : planCalendars(settings);
    return 'c.title IN (' + sqlList(titles) + ')';
}

export class SqliteCalendarEventRepository implements CalendarEventRepository {
    constructor(
        private readonly adapter: CalendarAdapter,
    ) {

    }

    public isSupported(): boolean {
        return this.adapter.isSupported();
    }

    public createEvent(calendar: string, draft: CalendarEventDraft): Promise<void> {
        const problem = this.checkWrite(calendar, draft);

        if (problem) {
            return Promise.reject(problem);
        }

        return this.adapter.runScript(this.inCalendar(calendar,
            'make new event with properties {summary:' + appleScriptLiteral(draft.summary ?? '') +
            ', start date:' + appleScriptDate(draft.start) +
            ', end date:' + appleScriptDate(draft.end) + '}\n'));
    }

    public updateEvent(event: CalendarEventIdentity, draft: CalendarEventDraft): Promise<void> {
        const problem = this.checkWrite(event.calendar, draft);

        if (problem) {
            return Promise.reject(problem);
        }

        // A draft with no title is not a draft with an empty title: the line is left
        // out entirely, so dragging a record to another time cannot rename it.
        const setSummary = draft.summary === undefined
            ? ''
            : 'set summary of dncEvent to ' + appleScriptLiteral(draft.summary) + '\n';

        return this.adapter.runScript(this.inCalendar(event.calendar, lookupScript(event) + setSummary +
            'set start date of dncEvent to ' + appleScriptDate(draft.start) + '\n' +
            'set end date of dncEvent to ' + appleScriptDate(draft.end) + '\n'));
    }

    public deleteEvent(event: CalendarEventIdentity): Promise<void> {
        if (!this.isSupported()) {
            return Promise.reject(new Error('This plugin only writes to Apple Calendar on macOS.'));
        }

        if (!event.calendar.trim()) {
            return Promise.reject(new Error('The event does not say which calendar it belongs to.'));
        }

        if (!Number.isFinite(event.start.getTime())) {
            return Promise.reject(new Error('The event does not say when it starts.'));
        }

        return this.adapter.runScript(this.inCalendar(event.calendar, lookupScript(event) +
            'delete dncEvent\n'));
    }

    public getEventsForDay(day: Date, mode: TimelineMode, settings: TimelineSettings): Promise<CalendarEventRow[]> {
        if (!this.isSupported()) {
            return Promise.reject(new Error('This plugin only reads Apple Calendar on macOS.'));
        }

        if (mode !== TimelineMode.Actual && mode !== TimelineMode.Plan) {
            return Promise.reject(new Error('The display mode is not valid.'));
        }

        // Checked before formatting, because date-fns throws on an invalid date
        // rather than handing back a string the pattern below could catch.
        if (!Number.isFinite(day.getTime())) {
            return Promise.reject(new Error('The selected date is not a valid date.'));
        }

        // The day after, reached through addDays rather than by adding a fixed number
        // of seconds, so the boundary survives a 23- or 25-hour day.
        const startKey = format(day, 'yyyy-MM-dd');
        const endKey = format(addDays(day, 1), 'yyyy-MM-dd');

        // The keys are concatenated into the query, so their shape is checked even
        // though they were just formatted here.
        if (!DATE_KEY_PATTERN.test(startKey) || !DATE_KEY_PATTERN.test(endKey)) {
            return Promise.reject(new Error('The selected date is not a valid date.'));
        }

        if (mode === TimelineMode.Plan && !planCalendars(settings).length) {
            const error: Error & {code?: string} = new Error('No calendar has been picked for plans. Choose one in the plugin settings.');
            error.code = NO_PLAN_CALENDAR;
            return Promise.reject(error);
        }

        return this.adapter.query(this.buildSql(startKey, endKey, mode, settings));
    }

    private inCalendar(calendar: string, body: string): string {
        return MAKE_DATE_HANDLER +
            'tell application "Calendar"\n' +
            'tell calendar ' + appleScriptLiteral(calendar) + '\n' +
            body +
            'end tell\n' +
            'end tell\n';
    }

    // The same three refusals guard every write, and they run before anything is
    // built: an invalid date throws inside the script builder, and an end that is not
    // after its start writes a record Calendar itself cannot draw.
    private checkWrite(calendar: string, draft: CalendarEventDraft): Error | null {
        if (!this.isSupported()) {
            return new Error('This plugin only writes to Apple Calendar on macOS.');
        }

        if (!calendar.trim()) {
            return new Error('No calendar has been chosen to write to. Pick one in the plugin settings.');
        }

        if (!Number.isFinite(draft.start.getTime()) || !Number.isFinite(draft.end.getTime())) {
            return new Error('The selected time is not a valid time.');
        }

        if (draft.end <= draft.start) {
            return new Error('The event has to end after it starts.');
        }

        return null;
    }

    private buildSql(startKey: string, endKey: string, mode: TimelineMode, settings: TimelineSettings): string {
        const selection =
            'SELECT COALESCE(ci.UUID, \'\') AS uid, c.title AS calendar, COALESCE(ci.summary, \'\') AS summary, ' +
            'datetime(ci.start_date + 978307200, \'unixepoch\', \'localtime\') AS starts_at, ' +
            'datetime(ci.end_date + 978307200, \'unixepoch\', \'localtime\') AS ends_at ' +
            'FROM CalendarItem ci JOIN Calendar c ON c.ROWID = ci.calendar_id ' +
            'WHERE ci.hidden = 0 AND ci.entity_type = 2 AND ';
        const dayRows = selection + calendarFilterSql(mode, settings) + ' ' +
            'AND datetime(ci.start_date + 978307200, \'unixepoch\', \'localtime\') < ' + sqlLiteral(endKey + ' 00:00:00') + ' ' +
            'AND datetime(ci.end_date + 978307200, \'unixepoch\', \'localtime\') >= ' + sqlLiteral(startKey + ' 00:00:00');

        if (mode !== TimelineMode.Actual) {
            return dayRows + ' ORDER BY ci.start_date, c.title;';
        }

        // An open stay carries no end time, so its end date can fall short of the day
        // filter. Union in the newest location row regardless of range; prepareDay
        // extends it only while nothing newer follows.
        const openStay = selection + 'c.title = ' + sqlLiteral(settings.locationCalendar) +
            ' ORDER BY ci.start_date DESC LIMIT 1';

        return 'SELECT * FROM (' + dayRows + ') UNION SELECT * FROM (' + openStay + ') ORDER BY starts_at, calendar;';
    }
}
