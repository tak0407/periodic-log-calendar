import React, {ReactElement} from 'react';
import {format} from 'date-fns';
import {Period} from 'src/domain/models/period.model';
import {TimelineItem} from 'src/domain/models/timeline.model';
import {TimelineColumn} from 'src/presentation/contracts/timeline.view-model';
import {useTimelineViewModel} from 'src/presentation/context/view-model.context';
import {bandIndex, bandPlan, BandPlan, hourPiece, hourRows, TimelineLane} from 'src/presentation/timeline/timebox';

export interface TimelineComponentProperties {
    period: Period | null;
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
    const [columns, setColumns] = React.useState<TimelineColumn[] | null>(null);
    const period = props.period;

    React.useEffect(() => {
        let cancelled = false;

        // Nothing is asked of the calendar on a platform that cannot answer, so an
        // unsupported install never shells out at all.
        if (!viewModel || !period || !viewModel.isSupported()) {
            setColumns(null);
            return;
        }

        setColumns(null);
        viewModel.loadDay(period.date).then(loaded => {
            if (!cancelled) {
                setColumns(loaded);
            }
        });

        return (): void => {
            cancelled = true;
        };
    }, [viewModel, period]);

    if (!period) {
        return (<p className="dnc-timeline-empty">날짜를 선택하세요.</p>);
    }

    if (!viewModel || !viewModel.isSupported()) {
        return (<p className="dnc-timeline-empty">기록·계획은 macOS 데스크톱에서만 읽을 수 있습니다.</p>);
    }

    if (!columns) {
        return (<p className="dnc-timeline-empty">불러오는 중…</p>);
    }

    const range = viewModel.getRange();
    const hours = hourRows(range);
    const plans = columns.map(column => bandPlan(column.day ? [column.day] : [], range));

    return (
        <div className="dnc-timeline" style={{['--dnc-timeline-row-height' as string]: ROW_HEIGHT_IN_PX + 'px'}}>
            <div className="dnc-timeline-head">
                <span className="dnc-timeline-hour" />
                {columns.map(column =>
                    <span key={column.mode} className="dnc-timeline-column-head">
                        {column.label}
                        {column.error && <em className="dnc-timeline-error">{column.error}</em>}
                    </span>,
                )}
            </div>

            <div className="dnc-timeline-grid">
                {hours.map(hour =>
                    <React.Fragment key={hour}>
                        <span className="dnc-timeline-hour">{hour.toString().padStart(2, '0')}</span>

                        {columns.map((column, columnIndex) =>
                            <TimelineCell
                                key={column.mode}
                                column={column}
                                plan={plans[columnIndex]}
                                hour={hour}
                                rangeStart={range.start} />,
                        )}
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
