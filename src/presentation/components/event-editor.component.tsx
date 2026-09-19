import React, {ReactElement} from 'react';
import {EventFormValues} from 'src/presentation/timeline/event-form';

export interface EventEditorComponentProperties {
    heading: string;
    values: EventFormValues;
    // The calendars a new plan may go to. Empty when the event already has one, since
    // moving between calendars is a copy and a delete rather than an edit.
    calendars: string[];
    deletable: boolean;
    top: number;
    onSave: (values: EventFormValues, calendar: string) => void;
    onDelete: () => void;
    onCancel: () => void;
}

// The editor sits on the grid, under the row it belongs to, rather than in a dialog in
// the middle of the window: the times being typed are the ones on the rows behind it,
// and a dialog would cover them.
export const EventEditorComponent = (props: EventEditorComponentProperties): ReactElement => {
    const [values, setValues] = React.useState<EventFormValues>(props.values);
    const [calendar, setCalendar] = React.useState<string>(props.calendars[0] ?? '');

    const change = (key: keyof EventFormValues) =>
        (event: React.ChangeEvent<HTMLInputElement>): void =>
            setValues(values => ({...values, [key]: event.target.value}));

    return (
        <form
            className="dnc-timeline-editor"
            style={{top: props.top + 'px'}}
            onSubmit={(event: React.FormEvent): void => {
                event.preventDefault();
                props.onSave(values, calendar);
            }}
            onKeyDown={(event: React.KeyboardEvent): void => {
                if (event.key === 'Escape') {
                    props.onCancel();
                }
            }}
            // A press inside the editor is aimed at the editor, not at the time on the
            // grid underneath it.
            onMouseDown={(event: React.MouseEvent): void => event.stopPropagation()}>
            <span className="dnc-timeline-editor-heading">{props.heading}</span>

            <label>
                제목
                <input
                    type="text"
                    autoFocus
                    value={values.summary}
                    placeholder="제목 없음"
                    onChange={change('summary')} />
            </label>

            <label>
                날짜
                <input type="date" value={values.day} onChange={change('day')} />
            </label>

            <span className="dnc-timeline-editor-times">
                <label>
                    시작
                    <input type="time" value={values.start} onChange={change('start')} />
                </label>
                <label>
                    종료
                    <input type="time" value={values.end} onChange={change('end')} />
                </label>
            </span>

            {props.calendars.length > 1 && <label>
                캘린더
                <select
                    value={calendar}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>): void => setCalendar(event.target.value)}>
                    {props.calendars.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </label>}

            <span className="dnc-timeline-editor-buttons">
                {props.deletable && <button type="button" className="mod-warning" onClick={props.onDelete}>삭제</button>}
                <button type="button" onClick={props.onCancel}>취소</button>
                <button type="submit" className="mod-cta">저장</button>
            </span>
        </form>
    );
};
