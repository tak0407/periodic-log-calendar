import React, {ReactElement} from 'react';
import {format} from 'date-fns';
import {Period} from 'src/domain/models/period.model';
import {hourValue, TimelineDay, TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {useTimelineViewModel} from 'src/presentation/context/view-model.context';
import {bandIndex, bandPlan, hourPiece, hourRows, TimelineLane} from 'src/presentation/timeline/timebox';

export interface TimelineComponentProperties {
    period: Period | null;
    mode: TimelineMode;
}

const ROW_HEIGHT_IN_PX = 44;
const MINUTE_MARKS = [0, 10, 20, 30, 40, 50];
const LANES: [TimelineLane, 'locations' | 'actions'][] = [
    ['location', 'locations'],
    ['focus', 'actions'],
];

// The whole record, as the block's accessible name. Obsidian renders an aria-label as
// its own tooltip, so this is also what a reader sees on hover — which is the only way
// to tell what a piece continuing from an earlier row is, since it carries no name.
const describe = (item: TimelineItem): string =>
    item.name + ' · ' + format(item.start, 'HH:mm') + '–' + format(item.end, 'HH:mm') + (item.active ? ' · 진행 중' : '');

export const TimelineComponent = (props: TimelineComponentProperties): ReactElement => {
    const viewModel = useTimelineViewModel();
    const [column, setColumn] = React.useState<TimelineColumn | null>(null);
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
    }, [viewModel, period, mode]);

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
    const now = new Date();

    return (
        <div className="dnc-timeline" style={{['--dnc-timeline-row-height' as string]: ROW_HEIGHT_IN_PX + 'px'}}>
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

            <div className="dnc-timeline-grid">
                {hourRows(range).map(hour =>
                    <React.Fragment key={hour}>
                        <span className="dnc-timeline-hour">{hour.toString().padStart(2, '0')}</span>
                        <TimelineCell
                            day={column.day}
                            hour={hour}
                            rangeStart={range.start}
                            now={now} />
                    </React.Fragment>,
                )}
            </div>
        </div>
    );
};

interface TimelineCellProperties {
    day: TimelineDay | null;
    hour: number;
    rangeStart: number;
    now: Date;
}

const TimelineCell = (props: TimelineCellProperties): ReactElement => {
    const day = props.day;
    // Counted for this row rather than for the whole day. The original shared one
    // count across the day so a band sat at the same height in the record column and
    // the plan column; those are separate tabs here, so nothing is left to line up
    // with, and reserving a lane all day for an hour that has none only leaves a hole.
    const plan = bandPlan(day ? [day] : [], {start: props.hour, end: props.hour + 1});
    const bandHeight = ROW_HEIGHT_IN_PX / Math.max(1, plan.bands);
    const nowHour = hourValue(props.now);
    // The clock belongs to today alone, and is a mark across the one cell it falls in.
    const showsNow = day?.today && nowHour >= props.hour && nowHour < props.hour + 1;

    return (
        <span className="dnc-timeline-cell" style={{['--dnc-timeline-band-height' as string]: bandHeight + 'px'}}>
            {day && LANES.map(([lane, key]) => day[key].map((item, index) => {
                const piece = hourPiece(item, props.hour, props.rangeStart);

                if (!piece) {
                    return null;
                }

                const description = describe(item);

                return (
                    <button
                        key={lane + index}
                        type="button"
                        className={'dnc-timeline-block ' + item.type
                            + (piece.continued ? ' continued' : '')
                            + (piece.continues ? ' continues' : '')
                            + (item.active ? ' active' : '')}
                        aria-label={description}
                        style={{
                            left: piece.left + '%',
                            width: piece.width + '%',
                            top: bandIndex(plan, lane, item.column) * bandHeight + 'px',
                            height: Math.max(4, bandHeight - 1) + 'px',
                        }}>
                        {!piece.continued && <span className="dnc-timeline-block-title">{item.name}</span>}
                    </button>
                );
            }))}

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
