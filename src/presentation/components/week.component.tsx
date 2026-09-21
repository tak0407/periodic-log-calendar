import React, {ReactElement} from 'react';
import {PeriodComponent} from 'src/presentation/components/period.component';
import {arePeriodsEqual, Period} from 'src/domain/models/period.model';
import {useWeeklyNoteViewModel} from 'src/presentation/context/view-model.context';
import {DailyNoteComponent} from 'src/presentation/components/day.component';
import {Week} from 'src/domain/models/week';

interface WeeklyNoteProperties {
    week: Week;
    days: Period[];
    today: Period | null;
    selectedPeriod: Period | null;
    currentMonth: Period | null;
    noteCountToken: number;
    onSelect: (period: Period) => void;
}

export const WeeklyNoteComponent = (props: WeeklyNoteProperties): ReactElement => {
    const viewModel = useWeeklyNoteViewModel();
    const [hasPeriodicNote, setHasPeriodicNote] = React.useState<boolean>(false);
    const isSelected = arePeriodsEqual(props.selectedPeriod, props.week);

    React.useEffect(() => {
        viewModel?.hasPeriodicNote(props.week).then(setHasPeriodicNote);
    }, [props.week, viewModel]);

    return (
        <tr>
            <td height="35" className="weekNumber">
                <PeriodComponent
                    name={props.week.name}
                    isSelected={isSelected}
                    isToday={false}
                    hasPeriodNote={hasPeriodicNote}
                    // The tabs under the calendar show one day, so there is nothing
                    // for a selected week to show them; the week number is only a way
                    // to its note, and the selected day stays where it was.
                    onClick={(key) => {
                        viewModel?.openNote(key, props.week);
                    }}
                    onOpenInHorizontalSplitViewClick={(key) => {
                        viewModel?.openNoteInHorizontalSplitView(key, props.week);
                    }}
                    onOpenInVerticalSplitViewClick={(key) => {
                        viewModel?.openNoteInVerticalSplitView(key, props.week);
                    }}
                    onDelete={() => viewModel?.deleteNote(props.week)}
                />
            </td>

            {props.days.map((day, index) => (
                <td height="35" key={index}>
                    <DailyNoteComponent
                        day={day}
                        selectedPeriod={props.selectedPeriod}
                        today={props.today}
                        isSameMonth={day.date.isSameMonth(props.currentMonth)}
                        noteCountToken={props.noteCountToken}
                        onSelect={() => props.onSelect(day)} />
                </td>
            ))}
        </tr>
    );
};
