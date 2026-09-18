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
import {TimelineMode} from 'src/domain/models/timeline.model';

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

    const renderTabs = async (): Promise<void> => {
        await act(async () => {
            render(<PeriodTabsComponent period={mockPeriod} />, {wrapper});
        });
    };

    const click = async (name: string): Promise<void> => {
        await act(async () => {
            fireEvent.click(screen.getByRole('tab', {name: name}));
        });
    };

    const selected = (name: string): boolean =>
        screen.getByRole('tab', {name: name}).getAttribute('aria-selected') === 'true';

    beforeEach(() => {
        when(mockNotesViewModel.loadNotes).mockResolvedValue([note]);
        when(mockTimelineViewModel.isSupported).mockReturnValue(true);
        when(mockTimelineViewModel.getRange).mockReturnValue({start: 9, end: 12});
        when(mockTimelineViewModel.loadDay).mockResolvedValue({
            mode: TimelineMode.Actual,
            day: {date: mockPeriod.date, today: true, future: false, locations: [], actions: []},
            error: null,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should offer notes, the record and the plan as three tabs', async () => {
        // Act
        await renderTabs();

        // Assert
        expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['노트', '기록', '계획']);
    });

    it('should show the notes first, so the area behaves as it did before the tabs', async () => {
        // Act
        await renderTabs();

        // Assert
        expect(selected('노트')).toBe(true);
        expect(screen.getByText(note.name)).toBeTruthy();
        expect(mockNotesViewModel.loadNotes).toHaveBeenCalledWith(mockPeriod);
    });

    it('should not touch the calendar until one of its tabs is opened', async () => {
        // Act
        await renderTabs();

        // Assert
        expect(mockTimelineViewModel.loadDay).not.toHaveBeenCalled();
    });

    it('should ask each timeline tab for its own side only', async () => {
        // Arrange
        await renderTabs();

        // Act
        await click('기록');
        await click('계획');

        // Assert
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledWith(mockPeriod.date, TimelineMode.Actual);
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledWith(mockPeriod.date, TimelineMode.Plan);
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(2);
    });

    it('should not read anything again when a tab that was already open is returned to', async () => {
        // Arrange
        await renderTabs();
        await click('기록');
        jest.clearAllMocks();

        // Act
        await click('계획');
        await click('노트');
        await click('기록');

        // Assert
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(1);
        expect(mockTimelineViewModel.loadDay).toHaveBeenCalledWith(mockPeriod.date, TimelineMode.Plan);
        expect(mockNotesViewModel.loadNotes).not.toHaveBeenCalled();
    });

    it('should keep the notes rendered while another tab is showing', async () => {
        // Arrange
        await renderTabs();

        // Act
        await click('기록');

        // Assert
        expect(selected('기록')).toBe(true);
        expect(screen.getByText(note.name)).toBeTruthy();
        expect(screen.getByText(note.name).closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
    });
});
