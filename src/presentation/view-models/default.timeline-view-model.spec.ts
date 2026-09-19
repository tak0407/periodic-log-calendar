import {when} from 'jest-when';
import {DefaultTimelineViewModel} from 'src/presentation/view-models/default.timeline-view-model';
import {TimelineManager} from 'src/business/contracts/timeline.manager';
import {TimelineDay, TimelineMode} from 'src/domain/models/timeline.model';
import {DEFAULT_PLUGIN_SETTINGS, PluginSettings} from 'src/domain/settings/plugin.settings';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';
import {NO_PLAN_CALENDAR} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';

describe('DefaultTimelineViewModel', () => {
    const timelineManager = {
        isSupported: jest.fn(),
        getDay: jest.fn(),
    } as jest.Mocked<TimelineManager>;
    const date = new Date(2023, 9, 2);
    const day = <TimelineDay>{date: date, today: true, future: false, locations: [], actions: []};
    let viewModel: DefaultTimelineViewModel;

    beforeEach(() => {
        viewModel = new DefaultTimelineViewModel(timelineManager);
        when(timelineManager.getDay).mockResolvedValue(day);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isSupported', () => {
        it('should follow the manager', () => {
            // Arrange
            when(timelineManager.isSupported).mockReturnValue(false);

            // Act & Assert
            expect(viewModel.isSupported()).toBe(false);
        });
    });

    describe('getRange', () => {
        it('should use the default window before any settings arrive', () => {
            // Act & Assert
            expect(viewModel.getRange()).toEqual({
                start: DEFAULT_TIMELINE_SETTINGS.dayStart,
                end: DEFAULT_TIMELINE_SETTINGS.dayEnd,
            });
        });

        it('should follow the timeline settings once they arrive', () => {
            // Arrange
            const settings = <PluginSettings>{
                ...DEFAULT_PLUGIN_SETTINGS,
                timelineSettings: <TimelineSettings>{...DEFAULT_TIMELINE_SETTINGS, dayStart: 8, dayEnd: 18},
            };

            // Act
            viewModel.updateSettings(settings);

            // Assert
            expect(viewModel.getRange()).toEqual({start: 8, end: 18});
        });
    });

    describe('loadDay', () => {
        it('should ask for only the side it was asked for', async () => {
            // Act
            const result = await viewModel.loadDay(date, TimelineMode.Actual);

            // Assert
            expect(timelineManager.getDay).toHaveBeenCalledTimes(1);
            expect(timelineManager.getDay).toHaveBeenCalledWith(date, TimelineMode.Actual, DEFAULT_TIMELINE_SETTINGS);
            expect(result.mode).toBe(TimelineMode.Actual);
            expect(result.day).toBe(day);
            expect(result.error).toBeNull();
        });

        it('should keep a failure in the side that caused it', async () => {
            // Arrange
            when(timelineManager.getDay).calledWith(date, TimelineMode.Plan, DEFAULT_TIMELINE_SETTINGS)
                .mockRejectedValue(new Error('something went wrong'));

            // Act
            const plan = await viewModel.loadDay(date, TimelineMode.Plan);
            const actual = await viewModel.loadDay(date, TimelineMode.Actual);

            // Assert
            expect(plan.day).toBeNull();
            expect(plan.error).toBe('something went wrong');
            expect(actual.day).toBe(day);
            expect(actual.error).toBeNull();
        });

        it('should point at the settings when no plan calendar has been picked', async () => {
            // Arrange
            const error: Error & {code?: string} = new Error('none picked');
            error.code = NO_PLAN_CALENDAR;
            when(timelineManager.getDay).calledWith(date, TimelineMode.Plan, DEFAULT_TIMELINE_SETTINGS)
                .mockRejectedValue(error);

            // Act
            const result = await viewModel.loadDay(date, TimelineMode.Plan);

            // Assert
            expect(result.error).toContain('설정에서');
        });

        it('should point at full disk access when the database cannot be opened', async () => {
            // Arrange
            when(timelineManager.getDay).calledWith(date, TimelineMode.Actual, DEFAULT_TIMELINE_SETTINGS)
                .mockRejectedValue(new Error('Error: unable to open database file'));

            // Act
            const result = await viewModel.loadDay(date, TimelineMode.Actual);

            // Assert
            expect(result.error).toContain('전체 디스크 접근 권한');
        });
    });
});
