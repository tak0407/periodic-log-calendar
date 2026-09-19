import React, {ReactElement} from 'react';
import {format} from 'date-fns';
import {Period} from 'src/domain/models/period.model';
import {
    atHour,
    CalendarEventDraft,
    HourRange,
    hourValue,
    TimelineDay,
    TimelineItem,
    TimelineMode,
    UNTITLED_EVENT,
} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {useTimelineViewModel} from 'src/presentation/context/view-model.context';
import {
    bandIndex,
    bandPlan,
    BandPlan,
    clockText,
    GrabEdge,
    grabEdge,
    hourPiece,
    hourRows,
    shiftSpan,
    snapHour,
    TimelineLane,
} from 'src/presentation/timeline/timebox';
import {EventFormValues, toDraft, toValues} from 'src/presentation/timeline/event-form';
import {EventEditorComponent} from 'src/presentation/components/event-editor.component';

export interface TimelineComponentProperties {
    period: Period | null;
    mode: TimelineMode;
}

const ROW_HEIGHT_IN_PX = 44;
const MINUTE_MARKS = [0, 10, 20, 30, 40, 50];
// A drag lands on a five-minute mark. Finer than the ten-minute rules the grid draws,
// so half past and quarter past are both reachable, and coarse enough that no drag
// ever produces a time nobody meant.
const SNAP_IN_MINUTES = 5;
// A record cannot be dragged shorter than one step, because a record of no length is
// not something the calendar can draw or anybody meant to make.
const MINIMUM_IN_HOURS = SNAP_IN_MINUTES / 60;
const LANES: [TimelineLane, 'locations' | 'actions'][] = [
    ['location', 'locations'],
    ['focus', 'actions'],
];

// The whole record, as the block's accessible name. Obsidian renders an aria-label as
// its own tooltip, so this is also what a reader sees on hover — which is the only way
// to tell what a piece continuing from an earlier row is, since it carries no name.
const describe = (item: TimelineItem): string =>
    item.name + ' · ' + format(item.start, 'HH:mm') + '–' + format(item.end, 'HH:mm') + (item.active ? ' · 진행 중' : '');

// The log is written by the shortcut that records it, so only plans are edited here.
// Plan is also the only type the plan tab produces, which is why this needs no second
// check against the tab it is drawn in. A record reaching outside its day is left
// alone as well: the times drawn for it are the day's edges rather than its own.
const isEditable = (item: TimelineItem): boolean => item.type === 'plan' && !item.clipped;

interface Grab {
    item: TimelineItem;
    edge: GrabEdge;
    from: number;
}

// The editor, and what it was opened on: the record being changed, or nothing at all
// for a span just dragged out. `opened` is what it started with, so a field left
// unreadable can fall back to it.
interface Editing {
    item: TimelineItem | null;
    opened: CalendarEventDraft;
    values: EventFormValues;
    top: number;
}

export const TimelineComponent = (props: TimelineComponentProperties): ReactElement => {
    const viewModel = useTimelineViewModel();
    const [column, setColumn] = React.useState<TimelineColumn | null>(null);
    const [reloadToken, setReloadToken] = React.useState(0);
    const [draft, setDraft] = React.useState<HourRange | null>(null);
    const [editing, setEditing] = React.useState<Editing | null>(null);
    const [now, setNow] = React.useState<Date>(() => new Date());
    const anchor = React.useRef<number | null>(null);
    // The span lives in a ref as well as in state: the state is what the grid draws,
    // but the press that ends the drag must not depend on a render having happened
    // between the last move and it.
    const dragged = React.useRef<HourRange | null>(null);
    const grabbed = React.useRef<Grab | null>(null);
    // A record that was dragged was not pressed to be opened, even when the pointer
    // happened to come back down on it.
    const dragWasNotAClick = React.useRef(false);
    const period = props.period;
    const mode = props.mode;

    React.useEffect(() => {
        let cancelled = false;

        // Nothing is asked of the calendar on a platform that cannot answer, so an
        // unsupported install never shells out at all.
        if (!viewModel || !period || !viewModel.isSupported()) {
            setColumn(null);
            return;
        }

        setColumn(null);
        viewModel.loadDay(period.date, mode).then(loaded => {
            if (!cancelled) {
                setColumn(loaded);
            }
        });

        return (): void => {
            cancelled = true;
        };
        setEditing(null);
    }, [viewModel, period, mode, reloadToken]);

    // The clock is the one thing on the grid that moves on its own while nobody touches it.
    React.useEffect(() => {
        const tick = window.setInterval(() => setNow(new Date()), 60000);
        return (): void => window.clearInterval(tick);
    }, []);

    const reloadOn = (changed: boolean): void => {
        if (changed) {
            setReloadToken(token => token + 1);
        }
    };

    // Where the pointer is on the clock, read off the cell it is over. The hour comes
    // from the cell and the minutes from how far across it the pointer sits, so this
    // holds whatever width the sidebar happens to be.
    const hourAt = (event: React.MouseEvent): number | null => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-hour]');
        const hour = Number(cell?.dataset.hour);
        const bounds = cell?.getBoundingClientRect();

        if (!bounds || !bounds.width || !Number.isFinite(hour)) {
            return null;
        }

        const across = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        return snapHour(hour + across, SNAP_IN_MINUTES);
    };

    const startDrag = (event: React.MouseEvent): void => {
        // The log tab draws what happened, and nothing there is made by hand.
        if (mode !== TimelineMode.Plan) {
            return;
        }

        setEditing(null);

        // A press that lands on a record is aimed at that record, not at the empty
        // time under it.
        if ((event.target as HTMLElement).closest('.dnc-timeline-block')) {
            return;
        }

        anchor.current = hourAt(event);
    };

    // A press on a record takes hold of it: of one of its ends if the pointer is on
    // one, of the whole record otherwise.
    const startGrab = (item: TimelineItem, edge: GrabEdge, event: React.MouseEvent): void => {
        const from = hourAt(event);

        if (from !== null) {
            grabbed.current = {item: item, edge: edge, from: from};
        }
    };

    // Only while something is actually being dragged. This runs on every pointer
    // move over the grid, and reading a cell's bounds is a layout read, so a plain
    // hover must cost nothing.
    const extendDrag = (event: React.MouseEvent): void => {
        const held = grabbed.current;
        const from = anchor.current;

        if (!held && from === null) {
            return;
        }

        const to = hourAt(event);

        if (to === null) {
            return;
        }

        const next = held
            ? shiftSpan({start: held.item.visualStart, end: held.item.visualEnd}, held.edge, to - held.from, MINIMUM_IN_HOURS)
            : to === from ? null : {start: Math.min(from!, to), end: Math.max(from!, to)};

        // The pointer moves by the pixel but the span moves by five minutes, so most
        // moves change nothing — and a span that has not changed redraws no row.
        if (next?.start === dragged.current?.start && next?.end === dragged.current?.end) {
            return;
        }

        dragged.current = next;
        setDraft(next);
    };

    const endDrag = (): void => {
        const hours = dragged.current;
        const held = grabbed.current;

        anchor.current = null;
        grabbed.current = null;
        dragged.current = null;
        setDraft(null);

        // A click is not a drag: it selects no span of time, so it asks for nothing.
        if (!hours || !viewModel || !period) {
            return;
        }

        if (held) {
            // Put back exactly where it was, which is a press that changed its mind
            // rather than a move — and still a press, so the editor may open.
            if (hours.start === held.item.visualStart && hours.end === held.item.visualEnd) {
                return;
            }

            // A dragged record decides everything the write needs, so it goes straight
            // through. No title is sent, so a move cannot rename what it moved.
            dragWasNotAClick.current = true;
            viewModel.updateEvent(held.item, {
                start: atHour(held.item.start, hours.start),
                end: atHour(held.item.start, hours.end),
            }).then(reloadOn);
            return;
        }

        openEditor(null, '', atHour(period.date, hours.start), atHour(period.date, hours.end));
    };

    // Under the row the event starts on, so the editor sits with the time it is about.
    // ponytail: an event on one of the last rows opens an editor the panel has to be
    // scrolled to; flip it above the row if that ever gets in the way.
    const openEditor = (item: TimelineItem | null, summary: string, start: Date, end: Date): void => {
        const rangeStart = viewModel?.getRange().start ?? 0;
        const row = Math.floor(hourValue(start)) - rangeStart + 1;

        setEditing({
            item: item,
            opened: {summary: summary, start: start, end: end},
            values: toValues(summary, start, end),
            top: Math.max(0, row) * ROW_HEIGHT_IN_PX,
        });
    };


    const edit = (item: TimelineItem): void =>
        openEditor(item, item.name === UNTITLED_EVENT ? '' : item.name, item.start, item.end);

    const save = (values: EventFormValues, calendar: string): void => {
        if (!editing || !viewModel) {
            return;
        }

        const draft = toDraft(values, editing.opened);
        const written = editing.item
            ? viewModel.updateEvent(editing.item, draft)
            : viewModel.createEvent(calendar, draft);

        setEditing(null);
        written.then(reloadOn);
    };

    const remove = (): void => {
        const item = editing?.item;

        setEditing(null);

        if (item) {
            viewModel?.deleteEvent(item).then(reloadOn);
        }
    };

    if (!period) {
        return (<p className="dnc-timeline-empty">날짜를 선택하세요.</p>);
    }

    if (!viewModel || !viewModel.isSupported()) {
        return (<p className="dnc-timeline-empty">기록·계획은 macOS 데스크톱에서만 읽을 수 있습니다.</p>);
    }

    if (!column) {
        return (<p className="dnc-timeline-empty">불러오는 중…</p>);
    }

    if (column.error) {
        return (<p className="dnc-timeline-empty dnc-timeline-error">{column.error}</p>);
    }

    const range = viewModel.getRange();
    const plan = bandPlan(column.day ? [column.day] : [], range);

    return (
        <div className="dnc-timeline" style={{
            ['--dnc-timeline-row-height' as string]: ROW_HEIGHT_IN_PX + 'px',
            ['--dnc-timeline-band-height' as string]: ROW_HEIGHT_IN_PX / Math.max(1, plan.bands) + 'px',
        }}>
            {/* The axis stays put while the hours scroll past it: an axis you cannot
                see is not an axis. */}
            <div className="dnc-timeline-top">
                <div className="dnc-timeline-head">
                    <span className="dnc-timeline-hour" />
                    <span className="dnc-timeline-ruler" aria-hidden="true">
                        {MINUTE_MARKS.map(minute => <span key={minute}>{minute}</span>)}
                    </span>
                </div>
            </div>

            {/* Dragging across empty time is how an event is made, so the whole grid
                listens: a drag crosses cells, and leaving the grid abandons it rather
                than writing whatever the last cell was. */}
            <div
                className="dnc-timeline-grid"
                onMouseDown={startDrag}
                onMouseMove={extendDrag}
                onMouseUp={endDrag}
                onClickCapture={(event: React.MouseEvent): void => {
                    if (dragWasNotAClick.current) {
                        dragWasNotAClick.current = false;
                        event.stopPropagation();
                    }
                }}
                onMouseLeave={(): void => {
                    anchor.current = null;
                    grabbed.current = null;
                    dragged.current = null;
                    setDraft(null);
                }}>
                {hourRows(range).map(hour =>
                    <React.Fragment key={hour}>
                        <span className="dnc-timeline-hour">{hour.toString().padStart(2, '0')}</span>
                        <TimelineCell
                            day={column.day}
                            plan={plan}
                            hour={hour}
                            rangeStart={range.start}
                            draft={draft}
                            now={now}
                            onEdit={edit}
                            onGrab={startGrab} />
                    </React.Fragment>,
                )}

                {editing && <EventEditorComponent
                    heading={editing.item ? '일정 수정' : '일정 추가'}
                    values={editing.values}
                    calendars={editing.item ? [] : (viewModel.getPlanCalendars())}
                    deletable={editing.item !== null}
                    top={editing.top}
                    onSave={save}
                    onDelete={remove}
                    onCancel={(): void => setEditing(null)} />}
            </div>
        </div>
    );
};

interface TimelineCellProperties {
    day: TimelineDay | null;
    plan: BandPlan;
    hour: number;
    rangeStart: number;
    draft: HourRange | null;
    now: Date;
    onEdit: (item: TimelineItem) => void;
    onGrab: (item: TimelineItem, edge: GrabEdge, event: React.MouseEvent) => void;
}

const TimelineCell = (props: TimelineCellProperties): ReactElement => {
    const day = props.day;
    // Counted once for the whole day, not for this row: a band keeps the same height
    // in every row, so a record does not change thickness as you read down the day.
    const bandHeight = ROW_HEIGHT_IN_PX / Math.max(1, props.plan.bands);
    const nowHour = hourValue(props.now);
    // The clock belongs to today alone, and is a mark across the one cell it falls in.
    const showsNow = day?.today && nowHour >= props.hour && nowHour < props.hour + 1;
    const draftPiece = props.draft
        ? hourPiece({visualStart: props.draft.start, visualEnd: props.draft.end}, props.hour, props.rangeStart)
        : null;

    return (
        <span className="dnc-timeline-cell" data-hour={props.hour}>
            {day && LANES.map(([lane, key]) => day[key].map((item, index) => {
                const piece = hourPiece(item, props.hour, props.rangeStart);

                if (!piece) {
                    return null;
                }

                const description = describe(item);
                const editable = isEditable(item);

                return (
                    <button
                        key={lane + index}
                        type="button"
                        className={'dnc-timeline-block ' + item.type
                            + (piece.continued ? ' continued' : '')
                            + (piece.continues ? ' continues' : '')
                            + (item.active ? ' active' : '')
                            + (editable ? ' editable' : '')}
                        aria-label={editable ? description + ' · 눌러서 수정, 끌어서 이동' : description}
                        onClick={editable ? (): void => props.onEdit(item) : undefined}
                        onMouseDown={editable ? (event: React.MouseEvent): void => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            props.onGrab(item, grabEdge(bounds, event.clientX, piece), event);
                        } : undefined}
                        style={{
                            left: piece.left + '%',
                            width: piece.width + '%',
                            top: bandIndex(props.plan, lane, item.column) * bandHeight + 'px',
                            height: Math.max(4, bandHeight - 1) + 'px',
                        }}>
                        {!piece.continued && <span className="dnc-timeline-block-title">{item.name}</span>}
                    </button>
                );
            }))}

            {/* The span being dragged, drawn over the whole row so it reads as time
                being chosen rather than as another record. */}
            {draftPiece && props.draft && <span
                className="dnc-timeline-draft"
                style={{left: draftPiece.left + '%', width: draftPiece.width + '%'}}>
                {!draftPiece.continued &&
                    <span>{clockText(props.draft.start)}–{clockText(props.draft.end)}</span>}
            </span>}

            {/* Past the half hour the label would run off the right of the cell and
                be cut, so it changes sides and sits before the line instead. */}
            {showsNow && <span
                className={'dnc-timeline-now' + (nowHour - props.hour >= 0.5 ? ' flipped' : '')}
                aria-label={'현재 시각 ' + format(props.now, 'HH:mm')}
                style={{left: (nowHour - props.hour) * 100 + '%'}}>
                <span>{format(props.now, 'HH:mm')}</span>
            </span>}
        </span>
    );
};
