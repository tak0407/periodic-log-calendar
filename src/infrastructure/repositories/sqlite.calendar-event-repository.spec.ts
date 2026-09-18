import {when} from 'jest-when';
import {mockCalendarAdapter} from 'src/test-helpers/adapter.mocks';
import {sqliteArguments} from 'src/infrastructure/adapters/calendar.adapter';
import {
    NO_PLAN_CALENDAR,
    sqlLiteral,
    SqliteCalendarEventRepository,
} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';
import {TimelineMode} from 'src/domain/models/timeline.model';
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

    beforeEach(() => {
        repository = new SqliteCalendarEventRepository(adapter);
        when(adapter.isSupported).mockReturnValue(true);
        when(adapter.query).mockResolvedValue([]);
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

        it('should return the rows the adapter read', async () => {
            // Arrange
            const rows = [{calendar: 'Where', summary: 'Home', starts_at: '2023-10-02 09:00:00', ends_at: '2023-10-02 10:00:00'}];
            when(adapter.query).mockResolvedValue(rows);

            // Act
            const result = await repository.getEventsForDay(new Date(2023, 9, 2), TimelineMode.Actual, settings);

            // Assert
            expect(result).toEqual(rows);
        });
    });
});
