import {when} from 'jest-when';
import {mockCalendarAdapter} from 'src/test-helpers/adapter.mocks';
import {osascriptArguments, sqliteArguments} from 'src/infrastructure/adapters/calendar.adapter';
import {
    appleScriptDate,
    appleScriptLiteral,
    NO_PLAN_CALENDAR,
    sqlLiteral,
    SqliteCalendarEventRepository,
} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';
import {CalendarEventDraft, CalendarEventIdentity, TimelineMode} from 'src/domain/models/timeline.model';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings} from 'src/domain/settings/timeline.settings';

describe('SqliteCalendarEventRepository', () => {
    const adapter = mockCalendarAdapter;
    const settings: TimelineSettings = {
        ...DEFAULT_TIMELINE_SETTINGS,
        locationCalendar: 'Where',
        focusCalendar: 'What',
        planCalendars: 'Plans, Appointments',
    };
    let repository: SqliteCalendarEventRepository;

    const capturedSql = (): string => adapter.query.mock.calls[0][0];
    const capturedScript = (): string => adapter.runScript.mock.calls[0][0];
    const draft = (summary = 'Lunch'): CalendarEventDraft => <CalendarEventDraft>{
        summary: summary,
        start: new Date(2023, 9, 2, 12, 0),
        end: new Date(2023, 9, 2, 13, 0),
    };
    const identity = <CalendarEventIdentity>{
        calendar: 'Plans',
        uid: 'event-uid',
        summary: 'Lunch',
        start: new Date(2023, 9, 2, 12, 0),
    };

    beforeEach(() => {
        repository = new SqliteCalendarEventRepository(adapter);
        when(adapter.isSupported).mockReturnValue(true);
        when(adapter.query).mockResolvedValue([]);
        when(adapter.runScript).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sqliteArguments', () => {
        it('should always open the database read-only', () => {
            // Act
            const result = sqliteArguments('/tmp/Calendar.sqlitedb', 'SELECT 1;');

            // Assert
            expect(result[0]).toBe('-readonly');
            expect(result).toEqual(['-readonly', '-json', '/tmp/Calendar.sqlitedb', 'SELECT 1;']);
        });
    });

    describe('sqlLiteral', () => {
        it('should quote a calendar title as a literal and double any apostrophe in it', () => {
            // Act & Assert
            expect(sqlLiteral('Work')).toBe('\'Work\'');
            expect(sqlLiteral('Bart\'s calendar')).toBe('\'Bart\'\'s calendar\'');
            expect(sqlLiteral('\'; DROP TABLE Calendar; --')).toBe('\'\'\'; DROP TABLE Calendar; --\'');
        });
    });

    describe('isSupported', () => {
        it('should follow the adapter', () => {
            // Arrange
            when(adapter.isSupported).mockReturnValue(false);

            // Act & Assert
            expect(repository.isSupported()).toBe(false);
        });
    });

    describe('getEventsForDay', () => {
        it('should reject without querying when the platform is not supported', async () => {
            // Arrange
            when(adapter.isSupported).mockReturnValue(false);

            // Act & Assert
            await expect(repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings))
                .rejects.toThrow('This plugin only reads Apple Calendar on macOS.');
            expect(adapter.query).not.toHaveBeenCalled();
        });

        it('should reject without querying when the display mode is not valid', async () => {
            // Act & Assert
            await expect(repository.getEventsForDay(new Date(2023, 9, 2), <TimelineMode>'sideways', settings))
                .rejects.toThrow('The display mode is not valid.');
            expect(adapter.query).not.toHaveBeenCalled();
        });

        it('should reject without querying when the date is not a valid date', async () => {
            // Act & Assert
            await expect(repository.getEventsForDay(new Date(NaN), TimelineMode.Actual, settings))
                .rejects.toThrow('The selected date is not a valid date.');
            expect(adapter.query).not.toHaveBeenCalled();
        });

        it('should reject with a recognisable code when plan mode has no calendars picked', async () => {
            // Arrange
            const withoutPlans = <TimelineSettings>{...settings, planCalendars: '  ,  '};

            // Act
            const result = repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Plan, withoutPlans);

            // Assert
            await expect(result).rejects.toMatchObject({code: NO_PLAN_CALENDAR});
            expect(adapter.query).not.toHaveBeenCalled();
        });

        it('should ask for the events of the selected day up to, but not including, the next day', async () => {
            // Act
            await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings);

            // Assert
            expect(capturedSql()).toContain('< \'2023-10-03 00:00:00\'');
            expect(capturedSql()).toContain('>= \'2023-10-02 00:00:00\'');
        });

        it('should step over a month boundary by calendar date', async () => {
            // Act
            await repository.getEventsForDay(new Date(2023, 9, 31), TimelineMode.Actual, settings);

            // Assert
            expect(capturedSql()).toContain('< \'2023-11-01 00:00:00\'');
        });

        it('should read the two log calendars and union the newest location row in actual mode', async () => {
            // Act
            await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings);

            // Assert
            expect(capturedSql()).toContain('c.title IN (\'Where\', \'What\')');
            expect(capturedSql()).toContain('UNION');
            expect(capturedSql()).toContain('c.title = \'Where\' ORDER BY ci.start_date DESC LIMIT 1');
        });

        it('should read only the picked calendars and no open stay in plan mode', async () => {
            // Act
            await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Plan, settings);

            // Assert
            expect(capturedSql()).toContain('c.title IN (\'Plans\', \'Appointments\')');
            expect(capturedSql()).not.toContain('UNION');
        });

        it('should quote a calendar title that carries an apostrophe', async () => {
            // Arrange
            const awkward = <TimelineSettings>{...settings, locationCalendar: 'Bart\'s'};

            // Act
            await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, awkward);

            // Assert
            expect(capturedSql()).toContain('\'Bart\'\'s\'');
        });

        it('should read the uid, so an event can be found again to edit it', async () => {
            // Act
            await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings);

            // Assert
            expect(capturedSql()).toContain('COALESCE(ci.UUID, \'\') AS uid');
        });

        it('should return the rows the adapter read', async () => {
            // Arrange
            const rows = [{uid: 'a', calendar: 'Where', summary: 'Home', starts_at: '2023-10-02 09:00:00', ends_at: '2023-10-02 10:00:00'}];
            when(adapter.query).mockResolvedValue(rows);

            // Act
            const result = await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings);

            // Assert
            expect(result).toEqual(rows);
        });
    });

    describe('appleScriptLiteral', () => {
        it('should quote a summary and escape what would end the string', () => {
            // Act & Assert
            expect(appleScriptLiteral('Lunch')).toBe('"Lunch"');
            expect(appleScriptLiteral('say "hi"')).toBe('"say \\"hi\\""');
            expect(appleScriptLiteral('back\\slash')).toBe('"back\\\\slash"');
        });

        it('should keep a line break from ending the statement it sits in', () => {
            // Act & Assert
            expect(appleScriptLiteral('two\nlines')).toBe('"two lines"');
        });
    });

    describe('appleScriptDate', () => {
        it('should hand over the parts of the date rather than a string a locale could read differently', () => {
            // Act & Assert
            expect(appleScriptDate(new Date(2023, 9, 2, 12, 30, 15)))
                .toBe('my dncDate(2023, 10, 2, 45015)');
        });
    });

    describe('createEvent', () => {
        it('should write through the Calendar app and never through the database', async () => {
            // Act
            await repository.createEvent('Plans', draft());

            // Assert
            expect(adapter.query).not.toHaveBeenCalled();
            expect(capturedScript()).toContain('tell application "Calendar"');
            expect(capturedScript()).toContain('tell calendar "Plans"');
            expect(capturedScript()).toContain(
                'make new event with properties {summary:"Lunch", start date:my dncDate(2023, 10, 2, 43200), end date:my dncDate(2023, 10, 2, 46800)}',
            );
        });

        it('should build its dates from a handler that sets the day before the month', async () => {
            // Act
            await repository.createEvent('Plans', draft());

            // Assert
            expect(capturedScript()).toContain('set day of theDate to 1\nset year of theDate to y\nset month of theDate to m\nset day of theDate to d');
        });

        it('should refuse to write on a platform that has no Apple Calendar', async () => {
            // Arrange
            when(adapter.isSupported).mockReturnValue(false);

            // Act & Assert
            await expect(repository.createEvent('Plans', draft())).rejects.toThrow('only writes to Apple Calendar on macOS');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });

        it('should refuse to write without a calendar to write to', async () => {
            // Act & Assert
            await expect(repository.createEvent('  ', draft())).rejects.toThrow('No calendar has been chosen');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });

        it('should refuse an event that does not end after it starts', async () => {
            // Arrange
            const backwards = <CalendarEventDraft>{summary: 'Lunch', start: new Date(2023, 9, 2, 13), end: new Date(2023, 9, 2, 12)};

            // Act & Assert
            await expect(repository.createEvent('Plans', backwards)).rejects.toThrow('has to end after it starts');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });

        it('should refuse a time that is not a time', async () => {
            // Arrange
            const invalid = <CalendarEventDraft>{summary: 'Lunch', start: new Date(NaN), end: new Date(2023, 9, 2, 13)};

            // Act & Assert
            await expect(repository.createEvent('Plans', invalid)).rejects.toThrow('not a valid time');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });
    });

    describe('updateEvent', () => {
        it('should find the event by its uid and write the new values onto it', async () => {
            // Act
            await repository.updateEvent(identity, draft('Dinner'));

            // Assert
            expect(capturedScript()).toContain('every event whose uid is "event-uid"');
            expect(capturedScript()).toContain('set summary of dncEvent to "Dinner"');
            expect(capturedScript()).toContain('set start date of dncEvent to my dncDate(2023, 10, 2, 43200)');
            expect(capturedScript()).toContain('set end date of dncEvent to my dncDate(2023, 10, 2, 46800)');
        });

        it('should fall back to what was stored when no uid matches', async () => {
            // Act
            await repository.updateEvent(identity, draft('Dinner'));

            // Assert
            expect(capturedScript()).toContain('every event whose summary is "Lunch" and start date is my dncDate(2023, 10, 2, 43200)');
        });

        it('should stop rather than write nothing when the event is gone', async () => {
            // Act
            await repository.updateEvent(identity, draft('Dinner'));

            // Assert
            expect(capturedScript()).toContain('error "The event is no longer in the calendar."');
        });

        it('should leave the title alone when the draft carries none', async () => {
            // Act
            await repository.updateEvent(identity, {start: new Date(2023, 9, 2, 14), end: new Date(2023, 9, 2, 15)});

            // Assert
            expect(capturedScript()).not.toContain('set summary of dncEvent');
            expect(capturedScript()).toContain('set start date of dncEvent to my dncDate(2023, 10, 2, 50400)');
        });

        it('should clear the title when the draft carries an empty one', async () => {
            // Act
            await repository.updateEvent(identity, draft(''));

            // Assert
            expect(capturedScript()).toContain('set summary of dncEvent to ""');
        });

        it('should refuse an event that does not end after it starts', async () => {
            // Arrange
            const backwards = <CalendarEventDraft>{summary: 'Lunch', start: new Date(2023, 9, 2, 13), end: new Date(2023, 9, 2, 13)};

            // Act & Assert
            await expect(repository.updateEvent(identity, backwards)).rejects.toThrow('has to end after it starts');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });
    });

    describe('deleteEvent', () => {
        it('should delete the event it found', async () => {
            // Act
            await repository.deleteEvent(identity);

            // Assert
            expect(capturedScript()).toContain('every event whose uid is "event-uid"');
            expect(capturedScript()).toContain('delete dncEvent');
        });

        it('should refuse to delete on a platform that has no Apple Calendar', async () => {
            // Arrange
            when(adapter.isSupported).mockReturnValue(false);

            // Act & Assert
            await expect(repository.deleteEvent(identity)).rejects.toThrow('only writes to Apple Calendar on macOS');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });

        it('should refuse to delete an event that does not say where it lives', async () => {
            // Act & Assert
            await expect(repository.deleteEvent({...identity, calendar: ''})).rejects.toThrow('does not say which calendar');
            await expect(repository.deleteEvent({...identity, start: new Date(NaN)})).rejects.toThrow('does not say when it starts');
            expect(adapter.runScript).not.toHaveBeenCalled();
        });
    });

    describe('osascriptArguments', () => {
        it('should hand the script to osascript as one expression', () => {
            // Act & Assert
            expect(osascriptArguments('tell application "Calendar"')).toEqual(['-e', 'tell application "Calendar"']);
        });
    });
});
