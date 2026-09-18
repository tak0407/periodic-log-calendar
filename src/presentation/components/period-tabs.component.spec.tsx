import React, {ReactNode} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {when} from 'jest-when';
import {PeriodTabsComponent} from 'src/presentation/components/period-tabs.component';
import {ViewModelsContext} from 'src/presentation/context/view-model.context';
import {ViewModelsContext as ViewModelsContextType} from 'src/presentation/context/view-model.context';
import {
    mockCalendarViewModel,
    mockDayNoteViewModel,
    mockNotesViewModel,
    mockPeriodNoteViewModel,
    mockTimelineViewModel,
} from 'src/test-helpers/view-model.mocks';
import {mockNoteWithCreatedOnProperty, mockPeriod} from 'src/test-helpers/model.mocks';

describe('PeriodTabsComponent', () => {
    const note = mockNoteWithCreatedOnProperty;

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
        when(mockNotesViewModel.loadNotes).mockResolvedValue([note]);
        when(mockTimelineViewModel.isSupported).mockReturnValue(false);
        when(mockTimelineViewModel.loadDay).mockResolvedValue([]);
        when(mockTimelineViewModel.getRange).mockReturnValue({start: 6, end: 24});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should show the notes first, so the area behaves as it did before the tabs', async () => {
        // Act
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });

        // Assert
        expect(screen.getByRole('tab', {name: '노트'}).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', {name: '기록·계획'}).getAttribute('aria-selected')).toBe('false');
        expect(screen.getByText(note.name)).toBeTruthy();
    });

    it('should load the notes for the selected period without waiting for a tab to be clicked', async () => {
        // Act
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });

        // Assert
        expect(mockNotesViewModel.loadNotes).toHaveBeenCalledWith(mockPeriod);
    });

    it('should show the timeline once its tab is clicked', async () => {
        // Arrange
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('tab', {name: '기록·계획'}));
        });

        // Assert
        expect(screen.getByRole('tab', {name: '기록·계획'}).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText('기록·계획은 macOS 데스크톱에서만 읽을 수 있습니다.')).toBeTruthy();
    });

    it('should not touch the calendar until its tab is opened', async () => {
        // Act
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });

        // Assert
        expect(mockTimelineViewModel.loadDay).not.toHaveBeenCalled();
    });

    it('should show the notes again when the notes tab is clicked back', async () => {
        // Arrange
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('tab', {name: '기록·계획'}));
        });

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('tab', {name: '노트'}));
        });

        // Assert
        expect(screen.getByRole('tab', {name: '노트'}).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText(note.name)).toBeTruthy();
    });
});
