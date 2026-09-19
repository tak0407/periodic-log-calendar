import {CalendarEventDraft, CalendarEventIdentity, TimelineDay, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';

export interface TimelineManager {
    isSupported(): boolean;
    getDay(date: Date, mode: TimelineMode, settings: TimelineSettings): Promise<TimelineDay>;
    createEvent(calendar: string, draft: CalendarEventDraft): Promise<void>;
    updateEvent(event: CalendarEventIdentity, draft: CalendarEventDraft): Promise<void>;
    deleteEvent(event: CalendarEventIdentity): Promise<void>;
}
