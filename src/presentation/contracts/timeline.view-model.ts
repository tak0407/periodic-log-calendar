import {CalendarEventDraft, HourRange, TimelineDay, TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {PluginSettings} from 'src/domain/settings/plugin.settings';

// One side of the timeline: what was recorded, or what was planned. A side that
// failed to load carries its own message, so one failing says so in its own tab
// without touching the other.
export interface TimelineColumn {
    mode: TimelineMode;
    day: TimelineDay | null;
    error: string | null;
}

export interface TimelineViewModel {
    updateSettings(settings: PluginSettings): void;
    isSupported(): boolean;
    getRange(): HourRange;
    loadDay(date: Date, mode: TimelineMode): Promise<TimelineColumn>;
    // Which calendars a new plan may be written to. Empty means none has been picked
    // in the settings, and nothing can be written until one is.
    getPlanCalendars(): string[];
    // All three answer whether the calendar changed, which is the only thing the view
    // has to know: a refused write leaves the day exactly as it was.
    createEvent(calendar: string, draft: CalendarEventDraft): Promise<boolean>;
    updateEvent(item: TimelineItem, draft: CalendarEventDraft): Promise<boolean>;
    deleteEvent(item: TimelineItem): Promise<boolean>;
}
