import {CalendarEventRow} from 'src/domain/models/timeline.model';

// Raw access to Apple Calendar: the database for reading, AppleScript for writing.
// The repository builds the SQL and the script; this only runs them and says whether
// running them is possible at all.
// Always -readonly, and -json so the rows parse. Reading never writes to the
// database, so the flag lives here where a test can hold it in place rather than
// inside the node call that no test reaches.
export function sqliteArguments(databasePath: string, sql: string): string[] {
    return ['-readonly', '-json', databasePath, sql];
}

// Writing goes nowhere near the database. The database is Apple Calendar's own, and
// a plugin writing into it behind CalendarAgent's back loses the change at the next
// sync at best. AppleScript is the supported way in, so a change is handed to the
// Calendar app and it writes its own store.
export function osascriptArguments(script: string): string[] {
    return ['-e', script];
}

export interface CalendarAdapter {
    isSupported(): boolean;
    query(sql: string): Promise<CalendarEventRow[]>;
    runScript(script: string): Promise<void>;
    openFullDiskAccessSettings(): void;
}
