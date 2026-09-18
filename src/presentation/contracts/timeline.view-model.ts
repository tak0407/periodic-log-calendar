import {HourRange, TimelineDay, TimelineMode} from 'src/domain/models/timeline.model';
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
}
