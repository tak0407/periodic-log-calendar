import {PluginSettingTab} from 'obsidian';
import {SettingsView, SettingUiModel} from 'src/presentation/settings/settings-view';
import {SettingsRepositoryFactory, SettingsType} from 'src/infrastructure/contracts/settings-repository-factory';
import {TimelineSettings} from 'src/domain/settings/timeline.settings';
import {DAY_END, DAY_START} from 'src/domain/models/timeline.model';

export class TimelineSettingsView extends SettingsView {
    override title = 'Log & plan';
    override description = 'Which Apple Calendar calendars the log and plan tab reads, and the part of the day it draws. macOS only, and the calendar database is only ever read.';

    constructor(
        protected readonly settingsTab: PluginSettingTab,
        onSettingsChange: () => void,
        private readonly settingsRepositoryFactory: SettingsRepositoryFactory,
    ) {
        super(settingsTab, onSettingsChange);
    }

    override async addSettings(): Promise<void> {
        const settingsRepository = this.settingsRepositoryFactory
            .getRepository<TimelineSettings>(SettingsType.Timeline);
        const settings = await settingsRepository.get();

        this.addTextSetting(this.calendarSetting(
            'Location calendar',
            'The calendar that records where you were. Its events make up the left lane of the log.',
            settings.locationCalendar,
        ), async value => {
            settings.locationCalendar = value;
            await settingsRepository.store(settings);
        });

        this.addTextSetting(this.calendarSetting(
            'Focus calendar',
            'The calendar that records what you were doing. Its events make up the right lane of the log.',
            settings.focusCalendar,
        ), async value => {
            settings.focusCalendar = value;
            await settingsRepository.store(settings);
        });

        this.addTextSetting(this.calendarSetting(
            'Plan calendars',
            'The calendars the plan column reads, separated by commas. Every other calendar stays out of it.',
            settings.planCalendars,
        ), async value => {
            settings.planCalendars = value;
            await settingsRepository.store(settings);
        });

        this.addTextSetting(this.calendarSetting(
            'Names that mean home',
            'Location names to colour as home, separated by commas.',
            settings.homeName,
        ), async value => {
            settings.homeName = value;
            await settingsRepository.store(settings);
        });

        this.addTextSetting(this.calendarSetting(
            'Names that mean travelling',
            'Location names to colour as travelling, separated by commas.',
            settings.moveName,
        ), async value => {
            settings.moveName = value;
            await settingsRepository.store(settings);
        });

        this.addTextSetting(this.calendarSetting(
            'Names that mean work',
            'Location names to colour as work, separated by commas.',
            settings.workName,
        ), async value => {
            settings.workName = value;
            await settingsRepository.store(settings);
        });

        this.addDropdownSetting(
            'First hour shown',
            'The top of the timeline.',
            this.hours(),
            settings.dayStart.toString(),
            async value => {
                settings.dayStart = Number(value);
                await settingsRepository.store(settings);
            },
        );

        this.addDropdownSetting(
            'Last hour shown',
            'The bottom of the timeline. An end at or before the start falls back to the whole working day.',
            this.hours(),
            settings.dayEnd.toString(),
            async value => {
                settings.dayEnd = Number(value);
                await settingsRepository.store(settings);
            },
        );
    }

    private calendarSetting(name: string, description: string, value: string): SettingUiModel<string> {
        return <SettingUiModel<string>>{
            name: name,
            description: description,
            placeholder: '',
            value: value,
        };
    }

    private hours(): Map<string, string> {
        const hours = new Map<string, string>();

        for (let hour = DAY_START; hour <= DAY_END; hour++) {
            hours.set(hour.toString(), hour.toString().padStart(2, '0') + ':00');
        }

        return hours;
    }
}
