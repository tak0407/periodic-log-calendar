import {SettingsRepository} from 'src/infrastructure/contracts/settings-repository';
import {SettingsAdapter} from 'src/infrastructure/adapters/settings.adapter';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';
import {DEFAULT_PLUGIN_SETTINGS} from 'src/domain/settings/plugin.settings';

export class TimelineSettingsRepository implements SettingsRepository<TimelineSettings> {
    constructor(
        private readonly adapter: SettingsAdapter,
    ) {

    }

    public async store(settings: TimelineSettings): Promise<void> {
        const storedSettings = await this.adapter.getSettings(DEFAULT_PLUGIN_SETTINGS);
        const allSettings = { ...storedSettings, timelineSettings: settings };
        await this.adapter.storeSettings(allSettings);
    }

    public async get(): Promise<TimelineSettings> {
        const allSettings = await this.adapter.getSettings(DEFAULT_PLUGIN_SETTINGS);
        return { ...DEFAULT_TIMELINE_SETTINGS, ...allSettings.timelineSettings };
    }
}
