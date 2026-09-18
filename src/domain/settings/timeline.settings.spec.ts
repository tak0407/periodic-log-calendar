import {
    DEFAULT_TIMELINE_SETTINGS,
    logCalendars,
    planCalendars,
    TimelineSettings,
    viewRange,
} from 'src/domain/settings/timeline.settings';

describe('timeline settings', () => {
    const settingsWith = (overrides: Partial<TimelineSettings>): TimelineSettings =>
        <TimelineSettings>{...DEFAULT_TIMELINE_SETTINGS, ...overrides};

    describe('planCalendars', () => {
        it('should split on commas and trim what is left', () => {
            expect(planCalendars(settingsWith({planCalendars: ' Plans , Appointments '})))
                .toEqual(['Plans', 'Appointments']);
        });

        it('should drop blanks and duplicates', () => {
            expect(planCalendars(settingsWith({planCalendars: 'Plans,,Plans,  ,Other'})))
                .toEqual(['Plans', 'Other']);
        });

        it('should return nothing for a value that is not a string', () => {
            expect(planCalendars(settingsWith({planCalendars: <string><unknown>null}))).toEqual([]);
        });
    });

    describe('logCalendars', () => {
        it('should be the location and the focus calendar, in that order', () => {
            expect(logCalendars(settingsWith({locationCalendar: 'Where', focusCalendar: 'What'})))
                .toEqual(['Where', 'What']);
        });
    });

    describe('viewRange', () => {
        it('should use the configured window', () => {
            expect(viewRange(settingsWith({dayStart: 8, dayEnd: 20}))).toEqual({start: 8, end: 20});
        });

        it('should fall back to the default window when the end is not after the start', () => {
            expect(viewRange(settingsWith({dayStart: 20, dayEnd: 20})))
                .toEqual({start: DEFAULT_TIMELINE_SETTINGS.dayStart, end: DEFAULT_TIMELINE_SETTINGS.dayEnd});
        });

        it('should pin an hour outside the day back into it', () => {
            expect(viewRange(settingsWith({dayStart: -5, dayEnd: 99}))).toEqual({start: 0, end: 24});
        });

        it('should fall back when an hour is not a number at all', () => {
            expect(viewRange(settingsWith({dayStart: <number><unknown>'morning', dayEnd: <number><unknown>'night'})))
                .toEqual({start: DEFAULT_TIMELINE_SETTINGS.dayStart, end: DEFAULT_TIMELINE_SETTINGS.dayEnd});
        });
    });
});
