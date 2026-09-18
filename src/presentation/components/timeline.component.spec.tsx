import React, {ReactNode} from 'react';
import {act, render, screen} from '@testing-library/react';
import {when} from 'jest-when';
import {TimelineComponent} from 'src/presentation/components/timeline.component';
import {ViewModelsContext} from 'src/presentation/context/view-model.context';
import {ViewModelsContext as ViewModelsContextType} from 'src/presentation/context/view-model.context';
import {
    mockCalendarViewModel,
    mockDayNoteViewModel,
    mockNotesViewModel,
    mockPeriodNoteViewModel,
    mockTimelineViewModel,
} from 'src/test-helpers/view-model.mocks';
import {mockPeriod} from 'src/test-helpers/model.mocks';
import {TimelineDay, TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {PeriodType} from 'src/domain/models/period.model';

describe('TimelineComponent', () => {
    const period = {...mockPeriod, type: PeriodType.Day, date: new Date(2023, 9, 2), name: '02'};

    const item = (name: string, visualStart: number, visualEnd: number): TimelineItem => ({
        name: name,
        calendar: 'Where',
        start: new Date(2023, 9, 2, Math.floor(visualStart)),
        end: new Date(2023, 9, 2, Math.floor(visualEnd)),
        visualStart: visualStart,
        visualEnd: visualEnd,
        type: 'home',
        active: false,
        column: 0,
        columns: 1,
    });

    const day = (locations: TimelineItem[]): TimelineDay => ({
        date: new Date(2023, 9, 2),
        today: true,
        future: false,
        locations: locations,
        actions: [],
    });

    const column = (locations: TimelineItem[], error: string | null = null): TimelineColumn => ({
        mode: TimelineMode.Actual,
        day: error ? null : day(locations),
        error: error,
    });

    const mockContext: ViewModelsContextType = {
        calendarViewModel: mockCalendarViewModel,
        dailyNoteViewModel: mockDayNoteViewModel,
        weeklyNoteViewModel: {...mockPeriodNoteViewModel},
        monthlyNoteViewModel: {...mockPeriodNoteViewModel},
        quarterlyNoteViewModel: {...mockPeriodNoteViewModel},
        yearlyNoteViewModel: {...mockPeriodNoteViewModel},
        notesViewModel: mockNotesViewModel,
        timelineViewModel: mockTimelineViewModel,
    };

    const wrapper = ({children}: {children: ReactNode}) => (
        <ViewModelsContext.Provider value={mockContext}>
            {children}
        </ViewModelsContext.Provider>
    );

    beforeEach(() => {
        when(mockTimelineViewModel.isSupported).mockReturnValue(true);
        when(mockTimelineViewModel.getRange).mockReturnValue({start: 9, end: 12});
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([]));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = async (mode = TimelineMode.Actual): Promise<void> => {
        await act(async () => {
            render(<TimelineComponent period={period} mode={mode} />, {wrapper});
        });
    };

    it('should ask for nothing and explain itself when no date is selected', async () => {
        // Act
        await act(async () => {
            render(<TimelineComponent period={null} mode={TimelineMode.Actual} />, {wrapper});
        });

        // Assert
        expect(screen.getByText('날짜를 선택하세요.')).toBeTruthy();
        expect(mockTimelineViewModel.loadDay).not.toHaveBeenCalled();
    });

    it('should explain itself rather than fail when the platform cannot read the calendar', async () => {
        // Arrange
        when(mockTimelineViewModel.isSupported).mockReturnValue(false);

        // Act
        await renderComponent();

        // Assert
        expect(screen.getByText('기록·계획은 macOS 데스크톱에서만 읽을 수 있습니다.')).toBeTruthy();
        expect(mockTimelineViewModel.loadDay).not.toHaveBeenCalled();
    });

    it('should ask for only the side it shows', async () => {
        // Act
        await renderComponent(TimelineMode.Plan);

        // Assert
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(1);
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledWith(period.date, TimelineMode.Plan);
    });

    it('should draw a row for every hour of the window, ending before the last one', async () => {
        // Act
        await renderComponent();

        // Assert
        expect(screen.getByText('09')).toBeTruthy();
        expect(screen.getByText('11')).toBeTruthy();
        expect(screen.queryByText('12')).toBeNull();
    });

    it('should name a record on the row it starts on and not on the rows it continues into', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 11)]));

        // Act
        await renderComponent();

        // Assert
        expect(screen.getAllByText('At home')).toHaveLength(1);
        expect(screen.getAllByTitle(/^At home/)).toHaveLength(2);
    });

    it('should show why a side could not be read instead of an empty grid', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay)
            .mockResolvedValue(column([], '계획에 사용할 캘린더가 선택되지 않았습니다. 설정에서 고르세요.'));

        // Act
        await renderComponent(TimelineMode.Plan);

        // Assert
        expect(screen.getByText('계획에 사용할 캘린더가 선택되지 않았습니다. 설정에서 고르세요.')).toBeTruthy();
        expect(screen.queryByText('09')).toBeNull();
    });
});
