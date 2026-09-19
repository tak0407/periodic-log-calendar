import {when} from 'jest-when';
import {DefaultTimelineViewModel} from 'src/presentation/view-models/default.timeline-view-model';
import {TimelineManager} from 'src/business/contracts/timeline.manager';
import {TimelineDay, TimelineItem, TimelineMode, UNTITLED_EVENT} from 'src/domain/models/timeline.model';
import {mockMessageAdapter} from 'src/test-helpers/adapter.mocks';
import {DEFAULT_PLUGIN_SETTINGS, PluginSettings} from 'src/domain/settings/plugin.settings';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';
import {NO_PLAN_CALENDAR} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';

describe('DefaultTimelineViewModel', () => {
    const timelineManager = {
        isSupported: jest.fn(),
        getDay: jest.fn(),
        createEvent: jest.fn(),
        updateEvent: jest.fn(),
        deleteEvent: jest.fn(),
    } as jest.Mocked<TimelineManager>;
    const messageAdapter = mockMessageAdapter;
    const item = (overrides: Partial<TimelineItem> = {}): TimelineItem => <TimelineItem>{
        uid: 'the-uid',
        name: 'Lunch',
        calendar: 'Plans',
        start: new Date(2023, 9, 2, 12),
        end: new Date(2023, 9, 2, 13),
        visualStart: 12,
        visualEnd: 13,
        type: 'plan',
        active: false,
        clipped: false,
        column: 0,
        columns: 1,
        ...overrides,
    };
    const date = new Date(2023, 9, 2);
    const day = <TimelineDay>{date: date, today: true, future: false, locations: [], actions: []};
    let viewModel: DefaultTimelineViewModel;

    beforeEach(() => {
        viewModel = new DefaultTimelineViewModel(timelineManager, messageAdapter);
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

    describe('getPlanCalendars', () => {
        it('should offer the calendars picked for plans', () => {
            // Act & Assert
            expect(viewModel.getPlanCalendars()).toEqual(['내 계획', '약속·확정 일정']);
        });

        it('should offer nothing when none has been picked', () => {
            // Arrange
            viewModel.updateSettings(<PluginSettings>{
                ...DEFAULT_PLUGIN_SETTINGS,
                timelineSettings: <TimelineSettings>{...DEFAULT_TIMELINE_SETTINGS, planCalendars: '  '},
            });

            // Act & Assert
            expect(viewModel.getPlanCalendars()).toEqual([]);
        });
    });

    describe('createEvent', () => {
        const draft = {summary: 'Lunch', start: new Date(2023, 9, 2, 12), end: new Date(2023, 9, 2, 13)};

        it('should write the event to the calendar it was given', async () => {
            // Act
            const result = await viewModel.createEvent('내 계획', draft);

            // Assert
            expect(timelineManager.createEvent).toHaveBeenCalledWith('내 계획', draft);
            expect(result).toBe(true);
        });

        it('should refuse a calendar that was not picked for plans', async () => {
            // Act
            const result = await viewModel.createEvent('단축어 기록', draft);

            // Assert
            expect(timelineManager.createEvent).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(messageAdapter.show).toHaveBeenCalledWith(expect.stringContaining('설정에서'));
        });

        it('should say so and leave the day alone when the write is refused', async () => {
            // Arrange
            when(timelineManager.createEvent).mockRejectedValue(new Error('Not authorized to send Apple events to Calendar.'));

            // Act
            const result = await viewModel.createEvent('내 계획', draft);

            // Assert
            expect(result).toBe(false);
            expect(messageAdapter.show).toHaveBeenCalledWith(expect.stringContaining('자동화'));
        });
    });

    describe('updateEvent', () => {
        const draft = {summary: 'Dinner', start: new Date(2023, 9, 2, 18), end: new Date(2023, 9, 2, 19)};

        it('should write against what was stored, so the event can be found again', async () => {
            // Act
            const result = await viewModel.updateEvent(item(), draft);

            // Assert
            expect(timelineManager.updateEvent).toHaveBeenCalledWith(
                {calendar: 'Plans', uid: 'the-uid', summary: 'Lunch', start: new Date(2023, 9, 2, 12)},
                draft,
            );
            expect(result).toBe(true);
        });

        it('should look an untitled event up by the nothing it was called, not by the placeholder', async () => {
            // Act
            await viewModel.updateEvent(item({name: UNTITLED_EVENT}), draft);

            // Assert
            expect(timelineManager.updateEvent.mock.calls[0][0].summary).toBe('');
        });

        it('should pass a draft with no title straight through, so a move cannot rename', async () => {
            // Act
            await viewModel.updateEvent(item(), {start: new Date(2023, 9, 2, 14), end: new Date(2023, 9, 2, 15)});

            // Assert
            expect(timelineManager.updateEvent.mock.calls[0][1].summary).toBeUndefined();
        });

        it('should refuse a record the shortcut owns', async () => {
            // Act
            const result = await viewModel.updateEvent(item({type: 'focus'}), draft);

            // Assert
            expect(timelineManager.updateEvent).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(messageAdapter.show).toHaveBeenCalledWith(expect.stringContaining('단축어'));
        });

        it('should refuse a record whose times are the day edges rather than its own', async () => {
            // Act
            const result = await viewModel.updateEvent(item({clipped: true}), draft);

            // Assert
            expect(timelineManager.updateEvent).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(messageAdapter.show).toHaveBeenCalledWith(expect.stringContaining('자정'));
        });

        it('should say so and leave the day alone when the write is refused', async () => {
            // Arrange
            when(timelineManager.updateEvent).mockRejectedValue(new Error('Not authorized to send Apple events to Calendar.'));

            // Act
            const result = await viewModel.updateEvent(item(), draft);

            // Assert
            expect(result).toBe(false);
            expect(messageAdapter.show).toHaveBeenCalledWith(expect.stringContaining('자동화'));
        });
    });

    describe('deleteEvent', () => {
        it('should delete what was stored', async () => {
            // Act
            const result = await viewModel.deleteEvent(item());

            // Assert
            expect(timelineManager.deleteEvent).toHaveBeenCalledWith(
                {calendar: 'Plans', uid: 'the-uid', summary: 'Lunch', start: new Date(2023, 9, 2, 12)},
            );
            expect(result).toBe(true);
        });

        it('should refuse a record the shortcut owns', async () => {
            // Act
            const result = await viewModel.deleteEvent(item({type: 'home'}));

            // Assert
            expect(timelineManager.deleteEvent).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });
});
