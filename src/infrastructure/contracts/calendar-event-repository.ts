import {CalendarEventRow, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';

export interface CalendarEventRepository {
    isSupported(): boolean;
    getEventsForDay(day: Date, mode: TimelineMode, settings: TimelineSettings): Promise<CalendarEventRow[]>;
}
