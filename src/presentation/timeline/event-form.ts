import {atHour, CalendarEventDraft, hourValue, parseClock, parseDay} from 'src/domain/models/timeline.model';

// What the editor's fields hold, as the fields themselves hold it: text, because a
// date and a time input hand back text and refuse everything that is not one.
export interface EventFormValues {
    summary: string;
    day: string;
    start: string;
    end: string;
}

function pad(value: number): string {
    return value.toString().padStart(2, '0');
}

export function toValues(summary: string, start: Date, end: Date): EventFormValues {
    const clock = (date: Date): string => pad(date.getHours()) + ':' + pad(date.getMinutes());
    const day = (date: Date): string =>
        date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

    return <EventFormValues>{summary: summary, day: day(start), start: clock(start), end: clock(end)};
}

// The fields as an event again. A field holding something unreadable keeps the value
// the editor was opened with rather than becoming an invalid date, and an end before
// its start is read as the next morning — the only thing 23:30 to 00:30 can mean on a
// grid that shows one day. Two times the same are left as they are and refused by the
// repository, rather than quietly becoming a whole day.
export function toDraft(values: EventFormValues, opened: CalendarEventDraft): CalendarEventDraft {
    const day = parseDay(values.day) ?? opened.start;
    const startsAt = parseClock(values.start) ?? hourValue(opened.start);
    const endsAt = parseClock(values.end) ?? hourValue(opened.end);

    return <CalendarEventDraft>{
        summary: values.summary.trim(),
        start: atHour(day, startsAt),
        end: atHour(day, endsAt < startsAt ? endsAt + 24 : endsAt),
    };
}
