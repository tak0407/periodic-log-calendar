import React, {ReactNode} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
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
        uid: 'uid-' + name,
        name: name,
        calendar: 'Where',
        start: new Date(2023, 9, 2, Math.floor(visualStart)),
        end: new Date(2023, 9, 2, Math.floor(visualEnd)),
        visualStart: visualStart,
        visualEnd: visualEnd,
        type: 'home',
        active: false,
        clipped: false,
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

    // jsdom lays nothing out, so a cell has to be told how wide it is before a
    // pointer position across it can mean anything.
    const CELL_WIDTH_IN_PX = 60;
    let bounds: jest.SpyInstance;

    beforeEach(() => {
        when(mockTimelineViewModel.isSupported).mockReturnValue(true);
        when(mockTimelineViewModel.getRange).mockReturnValue({start: 9, end: 12});
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([]));
        when(mockTimelineViewModel.getPlanCalendars).mockReturnValue(['내 계획']);
        when(mockTimelineViewModel.createEvent).mockResolvedValue(false);
        when(mockTimelineViewModel.updateEvent).mockResolvedValue(false);
        when(mockTimelineViewModel.deleteEvent).mockResolvedValue(false);
        bounds = jest.spyOn(Element.prototype, 'getBoundingClientRect')
            .mockReturnValue({left: 0, right: CELL_WIDTH_IN_PX, width: CELL_WIDTH_IN_PX} as unknown as DOMRect);
    });

    afterEach(() => {
        bounds.mockRestore();
        jest.clearAllMocks();
    });

    // A minute of the hour, as a pointer position across a cell one minute wide.
    const at = (minute: number): number => minute * CELL_WIDTH_IN_PX / 60;
    const cellFor = (hour: string): Element => document.querySelector('[data-hour="' + Number(hour) + '"]')!;

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

    it('should draw the minute axis so a position can be read', async () => {
        // Act
        await renderComponent();

        // Assert
        const ruler = document.querySelector('.dnc-timeline-ruler');
        expect(Array.from(ruler?.children ?? []).map(mark => mark.textContent))
            .toEqual(['0', '10', '20', '30', '40', '50']);
    });

    it('should mark the current time on today, on the row that holds it', async () => {
        // Arrange
        jest.useFakeTimers().setSystemTime(new Date(2023, 9, 2, 10, 30).getTime());

        // Act
        await renderComponent();

        // Assert
        const mark = screen.getByLabelText('현재 시각 10:30');
        expect(mark.style.left).toBe('50%');
        expect(mark.textContent).toBe('10:30');
        expect(screen.queryAllByLabelText(/현재 시각/)).toHaveLength(1);
        jest.useRealTimers();
    });

    it('should move the clock label to the other side of the line past the half hour', async () => {
        // Arrange
        jest.useFakeTimers().setSystemTime(new Date(2023, 9, 2, 10, 50).getTime());

        // Act
        await renderComponent();

        // Assert
        const mark = screen.getByLabelText('현재 시각 10:50');
        expect(mark.className).toContain('flipped');
        jest.useRealTimers();
    });

    it('should keep the clock label after the line before the half hour', async () => {
        // Arrange
        jest.useFakeTimers().setSystemTime(new Date(2023, 9, 2, 10, 10).getTime());

        // Act
        await renderComponent();

        // Assert
        expect(screen.getByLabelText('현재 시각 10:10').className).not.toContain('flipped');
        jest.useRealTimers();
    });

    it('should move the clock on its own as the minutes pass', async () => {
        // Arrange
        jest.useFakeTimers().setSystemTime(new Date(2023, 9, 2, 10, 15).getTime());

        try {
            // Act
            await renderComponent();

            // Assert
            expect(screen.getByLabelText('현재 시각 10:15').textContent).toBe('10:15');

            act(() => {
                jest.advanceTimersByTime(60000);
            });

            expect(screen.getByLabelText('현재 시각 10:16').textContent).toBe('10:16');
        } finally {
            jest.useRealTimers();
        }
    });

    it('should not mark the current time on a day that is not today', async () => {
        // Arrange
        jest.useFakeTimers().setSystemTime(new Date(2023, 9, 2, 10, 30).getTime());
        when(mockTimelineViewModel.loadDay).mockResolvedValue({
            mode: TimelineMode.Actual,
            day: {...day([]), today: false},
            error: null,
        });

        // Act
        await renderComponent();

        // Assert
        expect(screen.queryAllByLabelText(/현재 시각/)).toHaveLength(0);
        jest.useRealTimers();
    });

    it('should name every piece of a record, including one that carries no title of its own', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 11)]));

        // Act
        await renderComponent();

        // Assert
        const pieces = screen.getAllByLabelText('At home · 09:00–11:00');
        expect(pieces).toHaveLength(2);
        expect(pieces[1].textContent).toBe('');
    });

    it('should leave the naming to one tooltip rather than stacking several', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 10)]));

        // Act
        await renderComponent();

        // Assert
        expect(screen.getByLabelText('At home · 09:00–10:00').getAttribute('title')).toBeNull();
    });

    it('should name a record on the row it starts on and not on the rows it continues into', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 11)]));

        // Act
        await renderComponent();

        // Assert
        expect(screen.getAllByText('At home')).toHaveLength(1);
        expect(screen.getAllByLabelText(/^At home/)).toHaveLength(2);
    });

    it('should give a leading edge only to the row a record starts on', async () => {
        // Arrange
        when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 11)]));

        // Act
        await renderComponent();

        // Assert
        const pieces = screen.getAllByLabelText(/^At home/);
        expect(pieces[0].className).toContain('continues');
        expect(pieces[0].className).not.toContain('continued');
        expect(pieces[1].className).toContain('continued');
        expect(pieces[1].className).not.toContain('continues');
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

    const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
    const planned = (name: string): TimelineItem => ({...item(name, 9, 10), type: 'plan'});
    const block = (name: string): Element => screen.getAllByLabelText(new RegExp('^' + name))[0];

    const renderPlan = async (items: TimelineItem[] = []): Promise<void> => {
        when(mockTimelineViewModel.loadDay).mockResolvedValue({
            mode: TimelineMode.Plan,
            day: {...day([]), actions: items},
            error: null,
        });
        await renderComponent(TimelineMode.Plan);
    };

    describe('making an event by dragging', () => {
        const drag = async (fromHour: string, fromMinute: number, toHour: string, toMinute: number): Promise<void> => {
            await act(async () => {
                fireEvent.mouseDown(cellFor(fromHour), {clientX: at(fromMinute)});
                fireEvent.mouseMove(cellFor(toHour), {clientX: at(toMinute)});
                fireEvent.mouseUp(cellFor(toHour), {clientX: at(toMinute)});
            });
        };

        it('should open the editor on the span that was dragged', async () => {
            // Arrange
            await renderPlan();

            // Act
            await drag('09', 10, '10', 40);

            // Assert
            expect(screen.getByText('일정 추가')).toBeTruthy();
            expect(field('날짜').value).toBe('2023-10-02');
            expect(field('시작').value).toBe('09:10');
            expect(field('종료').value).toBe('10:40');
            expect(field('제목').value).toBe('');
        });

        it('should round the span to five minutes rather than to where the pointer happened to be', async () => {
            // Arrange
            await renderPlan();

            // Act
            await drag('09', 8, '09', 33);

            // Assert
            expect(field('시작').value).toBe('09:10');
            expect(field('종료').value).toBe('09:35');
        });

        it('should read a drag backwards as the same span', async () => {
            // Arrange
            await renderPlan();

            // Act
            await drag('11', 30, '10', 0);

            // Assert
            expect(field('시작').value).toBe('10:00');
            expect(field('종료').value).toBe('11:30');
        });

        it('should write what the editor was left holding', async () => {
            // Arrange
            when(mockTimelineViewModel.createEvent).mockResolvedValue(true);
            await renderPlan();
            await drag('09', 0, '10', 0);

            // Act
            await act(async () => {
                fireEvent.change(field('제목'), {target: {value: 'Lunch'}});
                fireEvent.click(screen.getByText('저장'));
            });

            // Assert
            expect(mockTimelineViewModel.createEvent).toHaveBeenCalledWith('내 계획', {
                summary: 'Lunch',
                start: new Date(2023, 9, 2, 9),
                end: new Date(2023, 9, 2, 10),
            });
            expect(screen.queryByText('일정 추가')).toBeNull();
            expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(2);
        });

        it('should write nothing when the editor is closed', async () => {
            // Arrange
            await renderPlan();
            await drag('09', 0, '10', 0);

            // Act
            await act(async () => {
                fireEvent.click(screen.getByText('취소'));
            });

            // Assert
            expect(mockTimelineViewModel.createEvent).not.toHaveBeenCalled();
            expect(screen.queryByText('일정 추가')).toBeNull();
        });

        it('should ask for nothing when the pointer only clicked', async () => {
            // Arrange
            await renderPlan();

            // Act
            await drag('09', 30, '09', 30);

            // Assert
            expect(screen.queryByText('일정 추가')).toBeNull();
        });

        it('should show the span while it is being dragged and drop it afterwards', async () => {
            // Arrange
            await renderPlan();

            // Act
            await act(async () => {
                fireEvent.mouseDown(cellFor('09'), {clientX: at(0)});
                fireEvent.mouseMove(cellFor('10'), {clientX: at(30)});
            });

            // Assert
            expect(screen.getByText('09:00–10:30')).toBeTruthy();

            // Act
            await act(async () => {
                fireEvent.mouseUp(cellFor('10'), {clientX: at(30)});
            });

            // Assert
            expect(screen.queryByText('09:00–10:30')).toBeNull();
        });

        it('should abandon a drag that leaves the grid', async () => {
            // Arrange
            await renderPlan();

            // Act
            await act(async () => {
                fireEvent.mouseDown(cellFor('09'), {clientX: at(0)});
                fireEvent.mouseMove(cellFor('10'), {clientX: at(30)});
                fireEvent.mouseLeave(cellFor('10').parentElement!);
                fireEvent.mouseUp(cellFor('10'), {clientX: at(30)});
            });

            // Assert
            expect(screen.queryByText('일정 추가')).toBeNull();
        });

        it('should cost nothing to merely move the pointer over the grid', async () => {
            // Arrange
            await renderPlan();
            bounds.mockClear();

            // Act
            await act(async () => {
                fireEvent.mouseMove(cellFor('09'), {clientX: at(10)});
                fireEvent.mouseMove(cellFor('10'), {clientX: at(20)});
            });

            // Assert
            expect(bounds).not.toHaveBeenCalled();
        });

        it('should not redraw for a move that stays on the same five-minute mark', async () => {
            // Arrange
            await renderPlan();
            await act(async () => {
                fireEvent.mouseDown(cellFor('09'), {clientX: at(0)});
                fireEvent.mouseMove(cellFor('10'), {clientX: at(30)});
            });
            const drawn = screen.getByText('09:00–10:30');

            // Act — one pixel over, still 10:30
            await act(async () => {
                fireEvent.mouseMove(cellFor('10'), {clientX: at(30) + 1});
            });

            // Assert — the same element, not a fresh one
            expect(screen.getByText('09:00–10:30')).toBe(drawn);
        });

        it('should make nothing in the log tab, which is the shortcut\'s to write', async () => {
            // Arrange
            await renderComponent(TimelineMode.Actual);

            // Act
            await drag('09', 0, '10', 0);

            // Assert
            expect(screen.queryByText('일정 추가')).toBeNull();
            expect(mockTimelineViewModel.createEvent).not.toHaveBeenCalled();
        });
    });

    describe('editing an event', () => {
        it('should open the editor on the record that was pressed', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await act(async () => {
                fireEvent.click(block('Lunch'));
            });

            // Assert
            expect(screen.getByText('일정 수정')).toBeTruthy();
            expect(field('제목').value).toBe('Lunch');
            expect(field('시작').value).toBe('09:00');
            expect(field('종료').value).toBe('10:00');
        });

        it('should write the change against the record it was opened on', async () => {
            // Arrange
            when(mockTimelineViewModel.updateEvent).mockResolvedValue(true);
            await renderPlan([planned('Lunch')]);
            await act(async () => {
                fireEvent.click(block('Lunch'));
            });

            // Act
            await act(async () => {
                fireEvent.change(field('제목'), {target: {value: 'Dinner'}});
                fireEvent.change(field('날짜'), {target: {value: '2023-10-09'}});
                fireEvent.click(screen.getByText('저장'));
            });

            // Assert
            expect(mockTimelineViewModel.updateEvent).toHaveBeenCalledWith(planned('Lunch'), {
                summary: 'Dinner',
                start: new Date(2023, 9, 9, 9),
                end: new Date(2023, 9, 9, 10),
            });
            expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(2);
        });

        it('should delete the record it was opened on', async () => {
            // Arrange
            when(mockTimelineViewModel.deleteEvent).mockResolvedValue(true);
            await renderPlan([planned('Lunch')]);
            await act(async () => {
                fireEvent.click(block('Lunch'));
            });

            // Act
            await act(async () => {
                fireEvent.click(screen.getByText('삭제'));
            });

            // Assert
            expect(mockTimelineViewModel.deleteEvent).toHaveBeenCalledWith(planned('Lunch'));
            expect(mockTimelineViewModel.updateEvent).not.toHaveBeenCalled();
            expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(2);
        });

        it('should leave a recorded stay alone, since the shortcut owns it', async () => {
            // Arrange
            when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 10)]));
            await renderComponent();

            // Act
            await act(async () => {
                fireEvent.click(block('At home'));
            });

            // Assert
            expect(screen.queryByText('일정 수정')).toBeNull();
        });

        it('should leave alone a record whose times are the day edges rather than its own', async () => {
            // Arrange
            await renderPlan([{...planned('Lunch'), clipped: true}]);

            // Act
            await act(async () => {
                fireEvent.click(block('Lunch'));
            });

            // Assert
            expect(screen.queryByText('일정 수정')).toBeNull();
        });

        it('should not start a drag from a press that landed on a record', async () => {
            // Arrange
            when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 10)]));
            await renderComponent();

            // Act
            await act(async () => {
                fireEvent.mouseDown(block('At home'), {clientX: at(0)});
                fireEvent.mouseMove(cellFor('10'), {clientX: at(30)});
                fireEvent.mouseUp(cellFor('10'), {clientX: at(30)});
            });

            // Assert
            expect(screen.queryByText('일정 추가')).toBeNull();
        });
    });

    describe('moving and resizing an event', () => {
        // The pointer goes down on the record itself and comes up over the grid, which
        // is how a real drag across rows lands.
        const dragBlock = async (grabAt: number, toHour: string, toMinute: number): Promise<void> => {
            await act(async () => {
                fireEvent.mouseDown(block('Lunch'), {clientX: grabAt});
                fireEvent.mouseMove(cellFor(toHour), {clientX: at(toMinute)});
                fireEvent.mouseUp(cellFor(toHour), {clientX: at(toMinute)});
            });
        };

        it('should move the record by as far as the pointer went, keeping its length', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '11', 30);

            // Assert
            expect(mockTimelineViewModel.updateEvent).toHaveBeenCalledWith(planned('Lunch'), {
                start: new Date(2023, 9, 2, 11),
                end: new Date(2023, 9, 2, 12),
            });
        });

        it('should carry no title, so a move cannot rename what it moved', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '11', 30);

            // Assert
            expect(mockTimelineViewModel.updateEvent.mock.calls[0][1].summary).toBeUndefined();
        });

        it('should write straight through, without an editor in the way', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '11', 30);

            // Assert
            expect(screen.queryByText('일정 수정')).toBeNull();
        });

        it('should drag the end it was taken by and leave the other where it is', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(CELL_WIDTH_IN_PX, '11', 0);

            // Assert
            expect(mockTimelineViewModel.updateEvent).toHaveBeenCalledWith(planned('Lunch'), {
                start: new Date(2023, 9, 2, 9),
                end: new Date(2023, 9, 2, 11),
            });
        });

        it('should drag the start the same way', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(0, '09', 30);

            // Assert
            expect(mockTimelineViewModel.updateEvent).toHaveBeenCalledWith(planned('Lunch'), {
                start: new Date(2023, 9, 2, 9, 30),
                end: new Date(2023, 9, 2, 10),
            });
        });

        it('should show where the record would land while it is being dragged', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await act(async () => {
                fireEvent.mouseDown(block('Lunch'), {clientX: at(30)});
                fireEvent.mouseMove(cellFor('11'), {clientX: at(30)});
            });

            // Assert
            expect(screen.getByText('11:00–12:00')).toBeTruthy();
        });

        it('should write nothing when the record is put back where it was', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '09', 30);

            // Assert
            expect(mockTimelineViewModel.updateEvent).not.toHaveBeenCalled();
        });

        it('should still open the editor for a press that moved nothing', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await act(async () => {
                fireEvent.mouseDown(block('Lunch'), {clientX: at(30)});
                fireEvent.mouseUp(block('Lunch'), {clientX: at(30)});
                fireEvent.click(block('Lunch'));
            });

            // Assert
            expect(screen.getByText('일정 수정')).toBeTruthy();
        });

        it('should not open the editor on the press that moved the record', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '11', 30);
            await act(async () => {
                fireEvent.click(block('Lunch'));
            });

            // Assert
            expect(screen.queryByText('일정 수정')).toBeNull();
        });

        it('should abandon a move that leaves the grid', async () => {
            // Arrange
            await renderPlan([planned('Lunch')]);

            // Act
            await act(async () => {
                fireEvent.mouseDown(block('Lunch'), {clientX: at(30)});
                fireEvent.mouseMove(cellFor('11'), {clientX: at(30)});
                fireEvent.mouseLeave(cellFor('11').parentElement!);
                fireEvent.mouseUp(cellFor('11'), {clientX: at(30)});
            });

            // Assert
            expect(mockTimelineViewModel.updateEvent).not.toHaveBeenCalled();
        });

        it('should read the day again once the record has been moved', async () => {
            // Arrange
            when(mockTimelineViewModel.updateEvent).mockResolvedValue(true);
            await renderPlan([planned('Lunch')]);

            // Act
            await dragBlock(at(30), '11', 30);

            // Assert
            expect(mockTimelineViewModel.loadDay).toHaveBeenCalledTimes(2);
        });

        it('should not let a recorded stay be dragged anywhere', async () => {
            // Arrange
            when(mockTimelineViewModel.loadDay).mockResolvedValue(column([item('At home', 9, 10)]));
            await renderComponent();

            // Act
            await act(async () => {
                fireEvent.mouseDown(block('At home'), {clientX: at(30)});
                fireEvent.mouseMove(cellFor('11'), {clientX: at(30)});
                fireEvent.mouseUp(cellFor('11'), {clientX: at(30)});
            });

            // Assert
            expect(mockTimelineViewModel.updateEvent).not.toHaveBeenCalled();
        });
    });
});
