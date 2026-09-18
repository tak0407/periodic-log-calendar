import {TimelineDay, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';

export interface TimelineManager {
    isSupported(): boolean;
    getDay(date: Date, mode: TimelineMode, settings: TimelineSettings): Promise<TimelineDay>;
}
