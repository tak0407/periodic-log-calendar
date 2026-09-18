import {HourRange, TimelineDay, TimelineMode} from 'src/domain/models/timeline.model';
import {PluginSettings} from 'src/domain/settings/plugin.settings';

// One side of the timeline: what was recorded, or what was planned. A column that
// failed to load carries its own message, so one side failing still leaves the other
// readable.
export interface TimelineColumn {
    mode: TimelineMode;
    label: string;
    day: TimelineDay | null;
    error: string | null;
}

export interface TimelineViewModel {
    updateSettings(settings: PluginSettings): void;
    isSupported(): boolean;
    getRange(): HourRange;
    loadDay(date: Date): Promise<TimelineColumn[]>;
}
