import {
    bandCount,
    bandIndex,
    bandPlan,
    hourPiece,
    hourRows,
    MIN_PIECE_PERCENT,
} from 'src/presentation/timeline/timebox';
import {HourRange, TimelineDay, TimelineItem} from 'src/domain/models/timeline.model';

describe('timebox', () => {
    const item = (visualStart: number, visualEnd: number, column = 0): TimelineItem => <TimelineItem>{
        name: 'Something',
        calendar: 'Where',
        start: new Date(2023, 9, 2),
        end: new Date(2023, 9, 2),
        visualStart: visualStart,
        visualEnd: visualEnd,
        type: 'place',
        active: false,
        column: column,
        columns: 1,
    };
    const range = <HourRange>{start: 6, end: 24};

    describe('hourPiece', () => {
        it('should return nothing for an hour the item does not reach', () => {
            expect(hourPiece(item(9, 10), 11, 6)).toBeNull();
        });

        it('should place a part hour by the minutes it covers', () => {
            // Act
            const result = hourPiece(item(9.25, 9.75), 9, 6);

            // Assert
            expect(result?.left).toBe(25);
            expect(result?.width).toBe(50);
        });

        it('should floor a piece too thin to see or hit', () => {
            // Act
            const result = hourPiece(item(9, 9 + 1 / 60), 9, 6);

            // Assert
            expect(result?.width).toBe(MIN_PIECE_PERCENT);
        });

        it('should keep a floored piece at the end of the hour inside the cell', () => {
            // Act
            const result = hourPiece(item(9.99, 10), 9, 6);

            // Assert
            expect(result?.left).toBeCloseTo(99);
            expect(result?.width).toBeCloseTo(1);
            expect((result?.left ?? 0) + (result?.width ?? 0)).toBeLessThanOrEqual(100);
        });

        it('should say a piece continues into the next row and is continued in the one after', () => {
            // Act
            const first = hourPiece(item(9, 11), 9, 6);
            const second = hourPiece(item(9, 11), 10, 6);

            // Assert
            expect(first?.continued).toBe(false);
            expect(first?.continues).toBe(true);
            expect(second?.continued).toBe(true);
            expect(second?.continues).toBe(false);
        });

        it('should give an item reaching in from before the window its name on the first row of that window', () => {
            // Act
            const result = hourPiece(item(3, 9), 6, 6);

            // Assert
            expect(result?.continued).toBe(false);
        });
    });

    describe('hourRows', () => {
        it('should end on the hour before the end of the window', () => {
            // Act
            const result = hourRows(range);

            // Assert
            expect(result).toHaveLength(18);
            expect(result[0]).toBe(6);
            expect(result[17]).toBe(23);
        });
    });

    describe('bandCount', () => {
        it('should read the deepest column in use rather than recount the overlaps', () => {
            expect(bandCount([item(9, 11, 0), item(10, 12, 1)], range)).toBe(2);
        });

        it('should ignore items that fall entirely outside the window', () => {
            expect(bandCount([item(1, 2, 3)], range)).toBe(0);
        });
    });

    describe('bandPlan', () => {
        const day = (locations: TimelineItem[], actions: TimelineItem[]): TimelineDay => <TimelineDay>{
            date: new Date(2023, 9, 2),
            today: true,
            future: false,
            locations: locations,
            actions: actions,
        };

        it('should take the deepest of each lane across every day on screen', () => {
            // Act
            const result = bandPlan([day([item(9, 11, 0), item(10, 12, 1)], [item(9, 10, 0)])], range);

            // Assert
            expect(result).toEqual({locations: 2, focus: 1, bands: 3});
        });

        it('should still leave a row somewhere to draw when there is nothing at all', () => {
            // Act
            const result = bandPlan([day([], [])], range);

            // Assert
            expect(result).toEqual({locations: 0, focus: 1, bands: 1});
        });
    });

    describe('bandIndex', () => {
        it('should put the focus lane below every location band', () => {
            // Arrange
            const plan = bandPlan([<TimelineDay>{
                date: new Date(2023, 9, 2),
                today: true,
                future: false,
                locations: [item(9, 11, 0), item(10, 12, 1)],
                actions: [item(9, 10, 0)],
            }], range);

            // Act & Assert
            expect(bandIndex(plan, 'location', 0)).toBe(0);
            expect(bandIndex(plan, 'location', 1)).toBe(1);
            expect(bandIndex(plan, 'focus', 0)).toBe(2);
        });
    });
});
