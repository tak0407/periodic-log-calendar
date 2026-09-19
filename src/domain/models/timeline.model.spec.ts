import {atHour, hourValue, parseClock, parseDay} from 'src/domain/models/timeline.model';

describe('timeline model', () => {
    const day = new Date(2023, 9, 2, 13, 37, 11);

    describe('atHour', () => {
        it('should place an hour of the day on the given date', () => {
            // Act
            const result = atHour(day, 9.5);

            // Assert
            expect(result).toEqual(new Date(2023, 9, 2, 9, 30));
        });

        it('should read the end of the day as the midnight that closes it', () => {
            // Act & Assert
            expect(atHour(day, 24)).toEqual(new Date(2023, 9, 3, 0, 0));
        });

        it('should round to the nearest minute rather than carry seconds', () => {
            // Act & Assert
            expect(atHour(day, 9 + 7 / 60 + 0.004)).toEqual(new Date(2023, 9, 2, 9, 7));
        });

        it('should leave the date it was given alone', () => {
            // Act
            atHour(day, 4);

            // Assert
            expect(day).toEqual(new Date(2023, 9, 2, 13, 37, 11));
        });

        it('should be the reverse of hourValue', () => {
            // Act & Assert
            expect(hourValue(atHour(day, 17.25))).toBe(17.25);
        });
    });

    describe('parseClock', () => {
        it('should read a time field as an hour of the day', () => {
            // Act & Assert
            expect(parseClock('09:30')).toBe(9.5);
            expect(parseClock('9:30')).toBe(9.5);
            expect(parseClock(' 00:00 ')).toBe(0);
        });

        it('should refuse anything that is not a time', () => {
            // Act & Assert
            expect(parseClock('')).toBeNull();
            expect(parseClock('half past nine')).toBeNull();
            expect(parseClock('9.30')).toBeNull();
            expect(parseClock('25:00')).toBeNull();
            expect(parseClock('09:73')).toBeNull();
        });
    });

    describe('parseDay', () => {
        it('should read a date field as the day it names, in the machine\'s own time zone', () => {
            // Act
            const result = parseDay('2026-09-19');

            // Assert
            expect(result).toEqual(new Date(2026, 8, 19));
            expect(result?.getDate()).toBe(19);
        });

        it('should refuse a day that does not exist', () => {
            // Act & Assert
            expect(parseDay('2026-02-31')).toBeNull();
            expect(parseDay('2026-13-01')).toBeNull();
        });

        it('should refuse anything that is not a date', () => {
            // Act & Assert
            expect(parseDay('')).toBeNull();
            expect(parseDay('19/09/2026')).toBeNull();
            expect(parseDay('2026-9-19')).toBeNull();
        });
    });
});
