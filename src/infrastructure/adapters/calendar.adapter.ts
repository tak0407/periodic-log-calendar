import {CalendarEventRow} from 'src/domain/models/timeline.model';

// Raw access to the Apple Calendar database. The repository builds the SQL; this
// only runs it and says whether running it is possible at all.
// Always -readonly, and -json so the rows parse. The plugin reads Apple Calendar
// and must never write to it, so the flag lives here where a test can hold it in
// place rather than inside the node call that no test reaches.
export function sqliteArguments(databasePath: string, sql: string): string[] {
    return ['-readonly', '-json', databasePath, sql];
}

export interface CalendarAdapter {
    isSupported(): boolean;
    query(sql: string): Promise<CalendarEventRow[]>;
    openFullDiskAccessSettings(): void;
}
