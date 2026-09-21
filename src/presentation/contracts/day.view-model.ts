import {PeriodNoteViewModel} from 'src/presentation/contracts/period.view-model';
import {Period} from 'src/domain/models/period.model';
import {ModifierKey} from 'src/domain/models/modifier-key';

export interface DayNoteViewModel extends PeriodNoteViewModel {
    getNoteCount(period: Period): Promise<number>;
    // Whether a click with this key opens the note, or only selects the day.
    opensNoteOnClick(key: ModifierKey): boolean;
}
