import {fireEvent, render, screen} from '@testing-library/react';
import {EventEditorComponent} from 'src/presentation/components/event-editor.component';
import {EventFormValues} from 'src/presentation/timeline/event-form';

describe('EventEditorComponent', () => {
    const values: EventFormValues = {summary: 'Lunch', day: '2023-10-02', start: '12:00', end: '13:00'};
    const onSave = jest.fn();
    const onDelete = jest.fn();
    const onCancel = jest.fn();

    const renderComponent = (overrides: Partial<React.ComponentProps<typeof EventEditorComponent>> = {}): void => {
        render(<EventEditorComponent
            heading="일정 수정"
            values={values}
            calendars={[]}
            deletable={true}
            top={88}
            onSave={onSave}
            onDelete={onDelete}
            onCancel={onCancel}
            {...overrides} />);
    };

    const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should open on the event it was given', () => {
        // Act
        renderComponent();

        // Assert
        expect(screen.getByText('일정 수정')).toBeTruthy();
        expect(field('제목').value).toBe('Lunch');
        expect(field('날짜').value).toBe('2023-10-02');
        expect(field('시작').value).toBe('12:00');
        expect(field('종료').value).toBe('13:00');
    });

    it('should stand against the row it is about', () => {
        // Act
        renderComponent();

        // Assert
        expect((screen.getByText('일정 수정').parentElement as HTMLElement).style.top).toBe('88px');
    });

    it('should hand back what was typed', () => {
        // Arrange
        renderComponent();

        // Act
        fireEvent.change(field('제목'), {target: {value: 'Dinner'}});
        fireEvent.change(field('종료'), {target: {value: '14:30'}});
        fireEvent.click(screen.getByText('저장'));

        // Assert
        expect(onSave).toHaveBeenCalledWith({summary: 'Dinner', day: '2023-10-02', start: '12:00', end: '14:30'}, '');
    });

    it('should offer the calendars a new event may go to, and only when there is a choice', () => {
        // Act
        renderComponent({calendars: ['내 계획', '약속·확정 일정'], deletable: false});

        // Assert
        expect(field('캘린더').value).toBe('내 계획');

        // Act
        fireEvent.change(screen.getByLabelText('캘린더'), {target: {value: '약속·확정 일정'}});
        fireEvent.click(screen.getByText('저장'));

        // Assert
        expect(onSave).toHaveBeenCalledWith(values, '약속·확정 일정');
    });

    it('should not ask which calendar when the event already has one', () => {
        // Act
        renderComponent({calendars: []});

        // Assert
        expect(screen.queryByLabelText('캘린더')).toBeNull();
    });

    it('should offer to delete only what already exists', () => {
        // Act
        renderComponent({deletable: false});

        // Assert
        expect(screen.queryByText('삭제')).toBeNull();
    });

    it('should delete when asked', () => {
        // Arrange
        renderComponent();

        // Act
        fireEvent.click(screen.getByText('삭제'));

        // Assert
        expect(onDelete).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('should close on escape and on the button, without writing anything', () => {
        // Arrange
        renderComponent();

        // Act
        fireEvent.keyDown(field('제목'), {key: 'Escape'});
        fireEvent.click(screen.getByText('취소'));

        // Assert
        expect(onCancel).toHaveBeenCalledTimes(2);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('should not let a press inside it reach the grid underneath', () => {
        // Arrange
        const onGridMouseDown = jest.fn();
        render(<div onMouseDown={onGridMouseDown}>
            <EventEditorComponent
                heading="일정 추가"
                values={values}
                calendars={[]}
                deletable={false}
                top={0}
                onSave={onSave}
                onDelete={onDelete}
                onCancel={onCancel} />
        </div>);

        // Act
        fireEvent.mouseDown(screen.getAllByText('일정 추가')[0]);

        // Assert
        expect(onGridMouseDown).not.toHaveBeenCalled();
    });
});
