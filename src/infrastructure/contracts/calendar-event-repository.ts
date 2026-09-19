import {CalendarEventDraft, CalendarEventIdentity, CalendarEventRow, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';

export interface CalendarEventRepository {
    isSupported(): boolean;
    getEventsForDay(day: Date, mode: TimelineMode, settings: TimelineSettings): Promise<CalendarEventRow[]>;
    createEvent(calendar: string, draft: CalendarEventDraft): Promise<void>;
    updateEvent(event: CalendarEventIdentity, draft: CalendarEventDraft): Promise<void>;
    deleteEvent(event: CalendarEventIdentity): Promise<void>;
}
