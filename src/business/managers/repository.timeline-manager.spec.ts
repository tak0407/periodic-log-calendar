import {when} from 'jest-when';
import {
    layoutOverlaps,
    locationType,
    mergeLocations,
    prepareDays,
    RepositoryTimelineManager,
} from 'src/business/managers/repository.timeline-manager';
import {CalendarEventRow, TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';
import {CalendarEventRepository} from 'src/infrastructure/contracts/calendar-event-repository';

describe('RepositoryTimelineManager', () => {
    const settings: TimelineSettings = {
        ...DEFAULT_TIMELINE_SETTINGS,
        locationCalendar: 'Where',
        focusCalendar: 'What',
        homeName: 'Home, My place',
        moveName: 'Moving',
        workName: 'Office',
    };
    const day = new Date(2023, 9, 2);
    const noon = new Date(2023, 9, 2, 12, 0, 0);

    const row = (calendar: string, summary: string, startsAt: string, endsAt: string, uid = 'uid-' + summary): CalendarEventRow =>
        <CalendarEventRow>{uid: uid, calendar: calendar, summary: summary, starts_at: startsAt, ends_at: endsAt};

    const item = (name: string, visualStart: number, visualEnd: number): TimelineItem => <TimelineItem>{
        name: name,
        calendar: 'Where',
        start: new Date(2023, 9, 2, Math.floor(visualStart)),
        end: new Date(2023, 9, 2, Math.floor(visualEnd)),
        visualStart: visualStart,
        visualEnd: visualEnd,
        type: 'place',
        active: false,
        column: 0,
        columns: 1,
    };

    describe('locationType', () => {
        it('should match any alias in the comma separated list', () => {
            expect(locationType('Home', settings)).toBe('home');
            expect(locationType('My place', settings)).toBe('home');
            expect(locationType('Moving', settings)).toBe('move');
            expect(locationType('Office', settings)).toBe('work');
            expect(locationType('Somewhere else', settings)).toBe('place');
        });

        it('should not let an empty alias catch every name', () => {
            // Arrange
            const trailingComma = <TimelineSettings>{...settings, homeName: 'Home,'};

            // Act & Assert
            expect(locationType('', trailingComma)).toBe('place');
            expect(locationType('Anything', trailingComma)).toBe('place');
        });
    });

    describe('mergeLocations', () => {
        it('should merge the same place across a gap of two minutes or less', () => {
            // Arrange
            const first = item('Home', 9, 10);
            const second = item('Home', 10, 11);
            second.start = new Date(first.end.getTime() + 120000);

            // Act
            const result = mergeLocations([first, second]);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].visualEnd).toBe(11);
        });

        it('should not merge the same place across a gap longer than two minutes', () => {
            // Arrange
            const first = item('Home', 9, 10);
            const second = item('Home', 10, 11);
            second.start = new Date(first.end.getTime() + 120001);

            // Act & Assert
            expect(mergeLocations([first, second])).toHaveLength(2);
        });

        it('should not merge two different places that touch', () => {
            // Arrange
            const first = item('Home', 9, 10);
            const second = item('Office', 10, 11);
            second.start = first.end;

            // Act & Assert
            expect(mergeLocations([first, second])).toHaveLength(2);
        });

        it('should carry the active flag of either part onto the merged stay', () => {
            // Arrange
            const first = item('Home', 9, 10);
            const second = item('Home', 10, 11);
            second.start = first.end;
            second.active = true;

            // Act
            const result = mergeLocations([first, second]);

            // Assert
            expect(result[0].active).toBe(true);
        });
    });

    describe('layoutOverlaps', () => {
        it('should put overlapping items in their own column and tell them how many there are', () => {
            // Act
            const result = layoutOverlaps([item('A', 9, 11), item('B', 10, 12)]);

            // Assert
            expect(result.map(i => i.column)).toEqual([0, 1]);
            expect(result.map(i => i.columns)).toEqual([2, 2]);
        });

        it('should reuse the first column once the previous item has ended', () => {
            // Act
            const result = layoutOverlaps([item('A', 9, 10), item('B', 10, 11)]);

            // Assert
            expect(result.map(i => i.column)).toEqual([0, 0]);
            expect(result.map(i => i.columns)).toEqual([1, 1]);
        });
    });

    describe('prepareDays', () => {
        it('should mark a record that reaches outside the day it is drawn on', () => {
            // Act
            const result = prepareDays([
                row('Where', 'Home', '2023-10-01 23:00:00', '2023-10-02 01:00:00'),
                row('Where', 'Office', '2023-10-02 09:00:00', '2023-10-02 10:00:00'),
            ], day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations.find(item => item.name === 'Home')?.clipped).toBe(true);
            expect(result[0].locations.find(item => item.name === 'Office')?.clipped).toBe(false);
        });

        it('should place an event by the wall clock rather than by elapsed seconds', () => {
            // Act
            const result = prepareDays([row('Where', 'Home', '2023-10-02 09:30:00', '2023-10-02 10:45:00')],
                day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations[0].visualStart).toBe(9.5);
            expect(result[0].locations[0].visualEnd).toBe(10.75);
        });

        it('should clip an event that runs past midnight to the end of the day', () => {
            // Act
            const result = prepareDays([row('Where', 'Home', '2023-10-02 22:00:00', '2023-10-03 07:00:00')],
                day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations[0].visualStart).toBe(22);
            expect(result[0].locations[0].visualEnd).toBe(24);
        });

        it('should extend the newest zero minute location row to now and mark it active', () => {
            // Act
            const result = prepareDays([row('Where', 'Home', '2023-10-02 11:00:00', '2023-10-02 11:00:00')],
                day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations[0].visualEnd).toBe(12);
            expect(result[0].locations[0].active).toBe(true);
        });

        it('should leave a zero minute location row alone when a newer one follows it', () => {
            // Act
            const result = prepareDays([
                row('Where', 'Home', '2023-10-02 09:00:00', '2023-10-02 09:00:00'),
                row('Where', 'Office', '2023-10-02 10:00:00', '2023-10-02 11:00:00'),
            ], day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations.map(i => i.name)).toEqual(['Office']);
        });

        it('should not extend a zero minute location row that starts after now', () => {
            // Act
            const result = prepareDays([row('Where', 'Home', '2023-10-02 18:00:00', '2023-10-02 18:00:00')],
                day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations).toHaveLength(0);
        });

        it('should split the focus calendar off into actions and leave the rest as locations', () => {
            // Act
            const result = prepareDays([
                row('Where', 'Home', '2023-10-02 09:00:00', '2023-10-02 10:00:00'),
                row('What', 'Writing', '2023-10-02 09:00:00', '2023-10-02 10:00:00'),
            ], day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations.map(i => i.type)).toEqual(['home']);
            expect(result[0].actions.map(i => i.type)).toEqual(['focus']);
        });

        it('should treat every event as a plan in plan mode', () => {
            // Act
            const result = prepareDays([row('Plans', 'Dentist', '2023-10-02 09:00:00', '2023-10-02 10:00:00')],
                day, 1, TimelineMode.Plan, settings, noon);

            // Assert
            expect(result[0].locations).toHaveLength(0);
            expect(result[0].actions.map(i => i.type)).toEqual(['plan']);
        });

        it('should drop a row whose dates do not parse', () => {
            // Act
            const result = prepareDays([row('Where', 'Home', 'not a date', 'also not a date')],
                day, 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(result[0].locations).toHaveLength(0);
        });

        it('should mark the day as today when it is, and as future when it is ahead', () => {
            // Act
            const today = prepareDays([], day, 1, TimelineMode.Actual, settings, noon);
            const tomorrow = prepareDays([], new Date(2023, 9, 3), 1, TimelineMode.Actual, settings, noon);

            // Assert
            expect(today[0].today).toBe(true);
            expect(tomorrow[0].future).toBe(true);
        });
    });

    describe('getDay', () => {
        const repository = {
            isSupported: jest.fn(),
            getEventsForDay: jest.fn(),
            createEvent: jest.fn(),
            updateEvent: jest.fn(),
            deleteEvent: jest.fn(),
        } as jest.Mocked<CalendarEventRepository>;
        let manager: RepositoryTimelineManager;

        beforeEach(() => {
            manager = new RepositoryTimelineManager(repository);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should ask the repository for the selected day and prepare it', async () => {
            // Arrange
            when(repository.getEventsForDay).calledWith(day, TimelineMode.Actual, settings)
                .mockResolvedValue([row('Where', 'Home', '2023-10-02 09:00:00', '2023-10-02 10:00:00')]);

            // Act
            const result = await manager.getDay(day, TimelineMode.Actual, settings);

            // Assert
            expect(result.date).toEqual(day);
            expect(result.locations.map(i => i.name)).toEqual(['Home']);
        });

        it('should carry the uid through, so the event can be found again to edit it', async () => {
            // Arrange
            when(repository.getEventsForDay).calledWith(day, TimelineMode.Actual, settings)
                .mockResolvedValue([row('Where', 'Home', '2023-10-02 09:00:00', '2023-10-02 10:00:00', 'the-uid')]);

            // Act
            const result = await manager.getDay(day, TimelineMode.Actual, settings);

            // Assert
            expect(result.locations[0].uid).toBe('the-uid');
        });

        it('should pass a new event to the repository', async () => {
            // Arrange
            const draft = {summary: 'Lunch', start: new Date(2023, 9, 2, 12), end: new Date(2023, 9, 2, 13)};

            // Act
            await manager.createEvent('Plans', draft);

            // Assert
            expect(repository.createEvent).toHaveBeenCalledWith('Plans', draft);
        });

        it('should pass a changed event to the repository', async () => {
            // Arrange
            const identity = {calendar: 'Plans', uid: 'the-uid', summary: 'Lunch', start: new Date(2023, 9, 2, 12)};
            const draft = {summary: 'Dinner', start: new Date(2023, 9, 2, 18), end: new Date(2023, 9, 2, 19)};

            // Act
            await manager.updateEvent(identity, draft);

            // Assert
            expect(repository.updateEvent).toHaveBeenCalledWith(identity, draft);
        });

        it('should pass a deleted event to the repository', async () => {
            // Arrange
            const identity = {calendar: 'Plans', uid: 'the-uid', summary: 'Lunch', start: new Date(2023, 9, 2, 12)};

            // Act
            await manager.deleteEvent(identity);

            // Assert
            expect(repository.deleteEvent).toHaveBeenCalledWith(identity);
        });

        it('should follow the repository on whether the platform is supported', () => {
            // Arrange
            when(repository.isSupported).mockReturnValue(false);

            // Act & Assert
            expect(manager.isSupported()).toBe(false);
        });
    });
});
