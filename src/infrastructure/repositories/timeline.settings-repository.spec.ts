import {when} from 'jest-when';
import {mockSettingsAdapter} from 'src/test-helpers/adapter.mocks';
import {DEFAULT_PLUGIN_SETTINGS, PluginSettings} from 'src/domain/settings/plugin.settings';
import {TimelineSettingsRepository} from 'src/infrastructure/repositories/timeline.settings-repository';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';

describe('TimelineSettingsRepository', () => {
    const settingsAdapter = mockSettingsAdapter;
    let repository: TimelineSettingsRepository;

    beforeEach(() => {
        repository = new TimelineSettingsRepository(settingsAdapter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should fill in the defaults for anything the stored settings leave out', async () => {
            // Arrange
            const stored = <PluginSettings>{
                ...DEFAULT_PLUGIN_SETTINGS,
                timelineSettings: <TimelineSettings>{...DEFAULT_TIMELINE_SETTINGS, locationCalendar: 'Where'},
            };
            when(settingsAdapter.getSettings).calledWith(DEFAULT_PLUGIN_SETTINGS).mockResolvedValue(stored);

            // Act
            const result = await repository.get();

            // Assert
            expect(result.locationCalendar).toBe('Where');
            expect(result.dayEnd).toBe(DEFAULT_TIMELINE_SETTINGS.dayEnd);
        });
    });

    describe('store', () => {
        it('should replace only the timeline settings and leave the rest of the plugin settings alone', async () => {
            // Arrange
            const stored = <PluginSettings>{...DEFAULT_PLUGIN_SETTINGS};
            const updated = <TimelineSettings>{...DEFAULT_TIMELINE_SETTINGS, focusCalendar: 'What'};
            when(settingsAdapter.getSettings).calledWith(DEFAULT_PLUGIN_SETTINGS).mockResolvedValue(stored);

            // Act
            await repository.store(updated);

            // Assert
            expect(settingsAdapter.storeSettings).toHaveBeenCalledWith(<PluginSettings>{
                ...DEFAULT_PLUGIN_SETTINGS,
                timelineSettings: updated,
            });
        });
    });
});
