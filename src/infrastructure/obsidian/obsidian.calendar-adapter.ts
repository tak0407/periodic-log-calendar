import {execFile} from 'child_process';
import {homedir} from 'os';
import {join} from 'path';
import {Platform} from 'obsidian';
import {CalendarAdapter, sqliteArguments} from 'src/infrastructure/adapters/calendar.adapter';
import {CalendarEventRow} from 'src/domain/models/timeline.model';

// Ported from weekly-log-viewer (https://github.com/tak0407/weekly-log-viewer) 1.4.0,
// src/calendar.js, MIT licensed, Copyright (c) 2026 김경탁. Rewritten in TypeScript
// against this repository's adapter layer; what it runs is unchanged.
//
// The database is opened with -readonly and nothing here ever writes to it. Node is
// imported directly rather than lazily because the manifest is desktop only, so this
// module is never loaded anywhere without one.

const SQLITE_BIN = '/usr/bin/sqlite3';
const OPEN_BIN = '/usr/bin/open';
const FULL_DISK_ACCESS_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';
const QUERY_TIMEOUT_IN_MS = 15000;
const MAX_BUFFER_IN_BYTES = 1024 * 1024;

export class ObsidianCalendarAdapter implements CalendarAdapter {
    public isSupported(): boolean {
        return Platform.isDesktopApp && Platform.isMacOS;
    }

    public query(sql: string): Promise<CalendarEventRow[]> {
        const databasePath = join(homedir(), 'Library', 'Group Containers', 'group.com.apple.calendar', 'Calendar.sqlitedb');

        return new Promise((resolve, reject) => {
            execFile(
                SQLITE_BIN,
                sqliteArguments(databasePath, sql),
                {maxBuffer: MAX_BUFFER_IN_BYTES, timeout: QUERY_TIMEOUT_IN_MS},
                (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error((stderr || error.message).trim()));
                        return;
                    }

                    try {
                        resolve(stdout.trim() ? JSON.parse(stdout) : []);
                    } catch {
                        reject(new Error('Could not read the result of the Calendar query.'));
                    }
                },
            );
        });
    }

    public openFullDiskAccessSettings(): void {
        if (!this.isSupported()) {
            return;
        }

        execFile(OPEN_BIN, [FULL_DISK_ACCESS_PANE]);
    }
}
