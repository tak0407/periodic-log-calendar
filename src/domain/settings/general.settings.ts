import {Settings} from 'src/domain/settings/settings';
import {DayOfWeek, WeekNumberStandard} from 'src/domain/models/week';

export interface GeneralSettings extends Settings {
    displayNotesCreatedOnDate: boolean;
    displayNoteIndicator: boolean;
    displayCreatedNoteCountIndicator: boolean;
    useModifierKeyToCreateNote: boolean;
    // Off, a click on a day only selects it, so the tabs below follow the day; the
    // note opens on a double click or a modifier click. On, a click opens the note
    // as well, which is how the original plugin behaves.
    openDailyNoteOnClick: boolean;
    firstDayOfWeek: DayOfWeek;
    weekNumberStandard: WeekNumberStandard;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    displayNotesCreatedOnDate: false,
    displayNoteIndicator: true,
    displayCreatedNoteCountIndicator: false,
    useModifierKeyToCreateNote: false,
    openDailyNoteOnClick: false,
    firstDayOfWeek: DayOfWeek.Monday,
    weekNumberStandard: WeekNumberStandard.ISO,
};
