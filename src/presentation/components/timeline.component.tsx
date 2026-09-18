import React, {ReactElement} from 'react';
import {format} from 'date-fns';
import {Period} from 'src/domain/models/period.model';
import {TimelineItem, TimelineMode} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {useTimelineViewModel} from 'src/presentation/context/view-model.context';
import {bandIndex, bandPlan, BandPlan, hourPiece, hourRows, TimelineLane} from 'src/presentation/timeline/timebox';

export interface TimelineComponentProperties {
    period: Period | null;
    mode: TimelineMode;
}

const ROW_HEIGHT_IN_PX = 44;
const LANES: [TimelineLane, 'locations' | 'actions'][] = [
    ['location', 'locations'],
    ['focus', 'actions'],
];

// The whole record on every piece of it, so any of them identifies it.
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
    const plan = bandPlan(column.day ? [column.day] : [], range);

    return (
        <div className="dnc-timeline" style={{['--dnc-timeline-row-height' as string]: ROW_HEIGHT_IN_PX + 'px'}}>
            <div className="dnc-timeline-grid">
                {hourRows(range).map(hour =>
                    <React.Fragment key={hour}>
                        <span className="dnc-timeline-hour">{hour.toString().padStart(2, '0')}</span>
                        <TimelineCell column={column} plan={plan} hour={hour} rangeStart={range.start} />
                    </React.Fragment>,
                )}
            </div>
        </div>
    );
};

interface TimelineCellProperties {
    column: TimelineColumn;
    plan: BandPlan;
    hour: number;
    rangeStart: number;
}

const TimelineCell = (props: TimelineCellProperties): ReactElement => {
    const day = props.column.day;
    const bandHeight = ROW_HEIGHT_IN_PX / Math.max(1, props.plan.bands);

    return (
        <span className="dnc-timeline-cell">
            {day && LANES.map(([lane, key]) => day[key].map((item, index) => {
                const piece = hourPiece(item, props.hour, props.rangeStart);

                if (!piece) {
                    return null;
                }

                // ponytail: the title attribute is the whole detail view; add a popover if reading a block's calendar and length off a tooltip stops being enough.
                return (
                    <span
                        key={lane + index}
                        className={'dnc-timeline-block ' + item.type + (item.active ? ' active' : '')}
                        title={describe(item)}
                        style={{
                            left: piece.left + '%',
                            width: piece.width + '%',
                            top: bandIndex(props.plan, lane, item.column) * bandHeight + 'px',
                            height: Math.max(4, bandHeight - 1) + 'px',
                        }}>
                        {!piece.continued && <strong>{item.name}</strong>}
                    </span>
                );
            }))}
        </span>
    );
};
