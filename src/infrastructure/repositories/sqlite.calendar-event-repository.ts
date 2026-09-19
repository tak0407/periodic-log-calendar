import {addDays, format} from 'date-fns';
import {CalendarEventRepository} from 'src/infrastructure/contracts/calendar-event-repository';
import {CalendarAdapter} from 'src/infrastructure/adapters/calendar.adapter';
import {CalendarEventRow, TimelineMode} from 'src/domain/models/timeline.model';
import {logCalendars, planCalendars, TimelineSettings} from 'src/domain/settings/timeline.settings';

// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// src/calendar.js, MIT licensed, Copyright (c) 2026 김경탁. The SQL, the validation
// and the open-stay union are unchanged; the week range became a single day.

export const NO_PLAN_CALENDAR = 'no-plan-calendar';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Calendar names reach the query as text, so they are quoted as SQL literals rather
// than concatenated raw.
export function sqlLiteral(value: string): string {
    return '\'' + String(value).replace(/'/g, '\'\'') + '\'';
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

    private buildSql(startKey: string, endKey: string, mode: TimelineMode, settings: TimelineSettings): string {
        const selection =
            'SELECT c.title AS calendar, COALESCE(ci.summary, \'\') AS summary, ' +
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
