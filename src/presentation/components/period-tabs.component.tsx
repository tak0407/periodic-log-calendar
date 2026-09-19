import React, {ReactElement} from 'react';
import {Period} from 'src/domain/models/period.model';
import {TimelineMode} from 'src/domain/models/timeline.model';
import {NotesComponent} from 'src/presentation/components/notes.component';
import {TimelineComponent} from 'src/presentation/components/timeline.component';

export interface PeriodTabsComponentProperties {
    period: Period | null;
}

const NOTES_TAB = 'notes';

const TABS: {key: string, label: string, mode: TimelineMode | null}[] = [
    {key: NOTES_TAB, label: '노트', mode: null},
    {key: TimelineMode.Actual, label: '기록', mode: TimelineMode.Actual},
    {key: TimelineMode.Plan, label: '계획', mode: TimelineMode.Plan},
];

// Notes is first and selected to begin with, so the area below the calendar behaves
// exactly as it did before the tabs existed.
//
// A tab is built the first time it is opened and then stays mounted, hidden by an
// attribute. Switching away and back therefore costs nothing: the notes are not
// re-listed and the calendar is not read again. Only a change of date reloads.
export const PeriodTabsComponent = (props: PeriodTabsComponentProperties): ReactElement => {
    const [selected, setSelected] = React.useState(NOTES_TAB);
    const [opened, setOpened] = React.useState<string[]>([NOTES_TAB]);

    const select = (key: string): void => {
        setSelected(key);
        setOpened(opened => opened.includes(key) ? opened : [...opened, key]);
    };

    return (
        <div className="dnc-tabs">
            <div className="dnc-tab-list" role="tablist">
                {TABS.map(({key, label}) =>
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        className={'dnc-tab' + (selected === key ? ' active' : '')}
                        aria-selected={selected === key}
                        onClick={() => select(key)}>
                        {label}
                    </button>,
                )}
            </div>

            {TABS.map(({key, mode}) =>
                <div key={key} role="tabpanel" hidden={selected !== key}>
                    {opened.includes(key) && (mode
                        ? <TimelineComponent period={props.period} mode={mode} />
                        : <NotesComponent period={props.period} />)}
                </div>,
            )}
        </div>
    );
};
