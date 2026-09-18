import React, {ReactElement} from 'react';
import {format} from 'date-fns';
import {Period} from 'src/domain/models/period.model';
import {hourValue, TimelineDay, TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {useTimelineViewModel} from 'src/presentation/context/view-model.context';
import {bandIndex, bandPlan, BandPlan, hourPiece, hourRows, TimelineLane} from 'src/presentation/timeline/timebox';

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

// The whole record, for the line above the grid and for anything that reads labels.
// A piece that continues from an earlier row carries no name of its own, so this is
// the only way to tell what one is.
const describe = (item: TimelineItem): string =>
    item.name + ' · ' + format(item.start, 'HH:mm') + '–' + format(item.end, 'HH:mm') + (item.active ? ' · 진행 중' : '');

export const TimelineComponent = (props: TimelineComponentProperties): ReactElement => {
    const viewModel = useTimelineViewModel();
    const [column, setColumn] = React.useState<TimelineColumn | null>(null);
    const [detail, setDetail] = React.useState<string | null>(null);
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
        setDetail(null);
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
    const plan = bandPlan(column.day ? [column.day] : [], range);
    const now = new Date();

    return (
        <div className="dnc-timeline" style={{
            ['--dnc-timeline-row-height' as string]: ROW_HEIGHT_IN_PX + 'px',
            ['--dnc-timeline-band-height' as string]: ROW_HEIGHT_IN_PX / Math.max(1, plan.bands) + 'px',
        }}>
            {/* Reading a block off a native tooltip proved unreliable inside Obsidian,
                so what is under the pointer is named here instead. The space is held
                open so the grid does not jump as the pointer moves. */}
            <p className="dnc-timeline-detail">{detail ?? ' '}</p>

            <div className="dnc-timeline-head">
                <span className="dnc-timeline-hour" />
                <span className="dnc-timeline-ruler" aria-hidden="true">
                    {MINUTE_MARKS.map(minute => <span key={minute}>{minute}</span>)}
                </span>
            </div>

            <div className="dnc-timeline-grid" onMouseLeave={() => setDetail(null)}>
                {hourRows(range).map(hour =>
                    <React.Fragment key={hour}>
                        <span className="dnc-timeline-hour">{hour.toString().padStart(2, '0')}</span>
                        <TimelineCell
                            day={column.day}
                            plan={plan}
                            hour={hour}
                            rangeStart={range.start}
                            now={now}
                            onDescribe={setDetail} />
                    </React.Fragment>,
                )}
            </div>
        </div>
    );
};

interface TimelineCellProperties {
    day: TimelineDay | null;
    plan: BandPlan;
    hour: number;
    rangeStart: number;
    now: Date;
    onDescribe: (detail: string | null) => void;
}

const TimelineCell = (props: TimelineCellProperties): ReactElement => {
    const day = props.day;
    const bandHeight = ROW_HEIGHT_IN_PX / Math.max(1, props.plan.bands);
    const nowHour = hourValue(props.now);
    // The clock belongs to today alone, and is a mark across the one cell it falls in.
    const showsNow = day?.today && nowHour >= props.hour && nowHour < props.hour + 1;

    return (
        <span className="dnc-timeline-cell">
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
                        title={description}
                        onMouseEnter={() => props.onDescribe(description)}
                        onFocus={() => props.onDescribe(description)}
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

            {showsNow && <span
                className="dnc-timeline-now"
                aria-label={'현재 시각 ' + format(props.now, 'HH:mm')}
                style={{left: (nowHour - props.hour) * 100 + '%'}}>
                <span>{format(props.now, 'HH:mm')}</span>
            </span>}
        </span>
    );
};
