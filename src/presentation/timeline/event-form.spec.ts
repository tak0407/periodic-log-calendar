import {toDraft, toValues} from 'src/presentation/timeline/event-form';
import {CalendarEventDraft} from 'src/domain/models/timeline.model';

describe('event form', () => {
    const opened = <CalendarEventDraft>{
        summary: 'Lunch',
        start: new Date(2023, 9, 2, 12, 0),
        end: new Date(2023, 9, 2, 13, 30),
    };

    describe('toValues', () => {
        it('should fill the fields from the event', () => {
            // Act & Assert
            expect(toValues('Lunch', opened.start, opened.end)).toEqual({
                summary: 'Lunch',
                day: '2023-10-02',
                start: '12:00',
                end: '13:30',
            });
        });

        it('should write the day as the machine reads it, not as UTC', () => {
            // Act & Assert
            expect(toValues('', new Date(2023, 0, 1, 0, 30), new Date(2023, 0, 1, 1, 0)).day).toBe('2023-01-01');
        });
    });

    describe('toDraft', () => {
        const values = toValues('Lunch', opened.start, opened.end);

        it('should read the fields back as an event', () => {
            // Act
            const result = toDraft({...values, summary: ' Dinner ', start: '18:00', end: '19:00'}, opened);

            // Assert
            expect(result).toEqual({
                summary: 'Dinner',
                start: new Date(2023, 9, 2, 18, 0),
                end: new Date(2023, 9, 2, 19, 0),
            });
        });

        it('should move the event to the day the date field names', () => {
            // Act
            const result = toDraft({...values, day: '2023-12-24'}, opened);

            // Assert
            expect(result.start).toEqual(new Date(2023, 11, 24, 12, 0));
            expect(result.end).toEqual(new Date(2023, 11, 24, 13, 30));
        });

        it('should read an end before its start as the next morning', () => {
            // Act
            const result = toDraft({...values, start: '23:30', end: '00:30'}, opened);

            // Assert
            expect(result.start).toEqual(new Date(2023, 9, 2, 23, 30));
            expect(result.end).toEqual(new Date(2023, 9, 3, 0, 30));
        });

        it('should leave two times the same alone rather than make a whole day of them', () => {
            // Act
            const result = toDraft({...values, start: '12:00', end: '12:00'}, opened);

            // Assert
            expect(result.end).toEqual(result.start);
        });

        it('should keep what the editor was opened with when a field holds nothing usable', () => {
            // Act
            const result = toDraft({summary: '', day: '', start: '', end: 'noon'}, opened);

            // Assert
            expect(result.start).toEqual(opened.start);
            expect(result.end).toEqual(opened.end);
            expect(result.summary).toBe('');
        });
    });
});
