import React, {ReactElement} from 'react';
import {Period} from 'src/domain/models/period.model';
import {NotesComponent} from 'src/presentation/components/notes.component';
import {TimelineComponent} from 'src/presentation/components/timeline.component';

export interface PeriodTabsComponentProperties {
    period: Period | null;
}

// Notes is first and selected to begin with, so the area below the calendar behaves
// exactly as it did before the tabs existed. Both panels stay mounted and the hidden
// one is hidden with an attribute, so switching back does not reload the notes.
export const PeriodTabsComponent = (props: PeriodTabsComponentProperties): ReactElement => {
    const [timelineSelected, setTimelineSelected] = React.useState(false);

    const tab = (label: string, selected: boolean, onSelect: () => void): ReactElement => (
        <button
            type="button"
            role="tab"
            className={'dnc-tab' + (selected ? ' active' : '')}
            aria-selected={selected}
            onClick={onSelect}>
            {label}
        </button>
    );

    return (
        <div className="dnc-tabs">
            <div className="dnc-tab-list" role="tablist">
                {tab('노트', !timelineSelected, () => setTimelineSelected(false))}
                {tab('기록·계획', timelineSelected, () => setTimelineSelected(true))}
            </div>

            <div role="tabpanel" hidden={timelineSelected}>
                <NotesComponent period={props.period} />
            </div>
            <div role="tabpanel" hidden={!timelineSelected}>
                {timelineSelected && <TimelineComponent period={props.period} />}
            </div>
        </div>
    );
};
