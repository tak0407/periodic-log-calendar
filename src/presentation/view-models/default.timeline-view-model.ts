import {TimelineColumn, TimelineViewModel} from 'src/presentation/contracts/timeline.view-model';
import {TimelineManager} from 'src/business/contracts/timeline.manager';
import {
    CalendarEventDraft,
    CalendarEventIdentity,
    HourRange,
    TimelineItem,
    TimelineMode,
    UNTITLED_EVENT,
} from 'src/domain/models/timeline.model';
import {PluginSettings} from 'src/domain/settings/plugin.settings';
import {DEFAULT_TIMELINE_SETTINGS, planCalendars, TimelineSettings, viewRange} from 'src/domain/settings/timeline.settings';
import {NO_PLAN_CALENDAR} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';
import {MessageAdapter} from 'src/presentation/adapters/message.adapter';

const MISSING_ACCESS_PATTERN = /authorization denied|unable to open database|not authorized|no such file/i;
// macOS refuses an Apple event before the plugin ever reaches Calendar, and that is a
// different switch in a different settings pane than the one reading needs.
const MISSING_AUTOMATION_PATTERN = /not authorized to send apple events|-1743/i;

export class DefaultTimelineViewModel implements TimelineViewModel {
    private settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS;

    constructor(
        private readonly timelineManager: TimelineManager,
        private readonly messageAdapter: MessageAdapter,
    ) {

    }

    public updateSettings(settings: PluginSettings): void {
        this.settings = settings.timelineSettings;
    }

    public isSupported(): boolean {
        return this.timelineManager.isSupported();
    }

    public getRange(): HourRange {
        return viewRange(this.settings);
    }

    // One side at a time, so a tab only ever asks for what it shows, and a failure
    // stays in the tab that caused it.
    public async loadDay(date: Date, mode: TimelineMode): Promise<TimelineColumn> {
        try {
            const day = await this.timelineManager.getDay(date, mode, this.settings);
            return <TimelineColumn>{mode: mode, day: day, error: null};
        } catch (error) {
            return <TimelineColumn>{mode: mode, day: null, error: this.messageFor(error)};
        }
    }

    public getPlanCalendars(): string[] {
        return planCalendars(this.settings);
    }

    // Only plans are written from here. The log is what a shortcut recorded, and a
    // record typed in by hand is not something that happened.
    public async createEvent(calendar: string, draft: CalendarEventDraft): Promise<boolean> {
        if (!this.getPlanCalendars().includes(calendar)) {
            this.messageAdapter.show('계획에 사용할 캘린더가 선택되지 않았습니다. 설정에서 고르세요.');
            return false;
        }

        return await this.write(() => this.timelineManager.createEvent(calendar, draft));
    }

    // A draft with no title leaves the title alone, which is how a record dragged to
    // another time keeps what it was called — including having been called nothing.
    public async updateEvent(item: TimelineItem, draft: CalendarEventDraft): Promise<boolean> {
        if (!this.isWritable(item)) {
            return false;
        }

        return await this.write(() => this.timelineManager.updateEvent(this.identityOf(item), draft));
    }

    public async deleteEvent(item: TimelineItem): Promise<boolean> {
        if (!this.isWritable(item)) {
            return false;
        }

        return await this.write(() => this.timelineManager.deleteEvent(this.identityOf(item)));
    }

    // What may be written back, and what to say when it may not. A log record belongs
    // to the shortcut that wrote it; and the times on a record reaching outside its
    // day are the day's edges rather than the event's own, so writing them back would
    // cut the event down to the part that happens to be on screen.
    private isWritable(item: TimelineItem): boolean {
        if (item.type !== 'plan') {
            this.messageAdapter.show('기록은 단축어가 남기는 것이라 여기서 고치지 않습니다.');
            return false;
        }

        if (item.clipped) {
            this.messageAdapter.show('자정을 넘는 일정은 캘린더 앱에서 수정하세요.');
            return false;
        }

        return true;
    }

    // The stored values, so the event can be found again when its uid matches nothing.
    // The placeholder an untitled record is drawn with is not one of them.
    private identityOf(item: TimelineItem): CalendarEventIdentity {
        return <CalendarEventIdentity>{
            calendar: item.calendar,
            uid: item.uid,
            summary: item.name === UNTITLED_EVENT ? '' : item.name,
            start: item.start,
        };
    }

    // A refused write says so where the person is looking and leaves the day alone,
    // rather than replacing the timeline with an error and losing what it showed.
    private async write(action: () => Promise<void>): Promise<boolean> {
        try {
            await action();
            return true;
        } catch (error) {
            this.messageAdapter.show(this.messageFor(error));
            return false;
        }
    }

    private messageFor(error: unknown): string {
        if ((<{code?: string}>error)?.code === NO_PLAN_CALENDAR) {
            return '계획에 사용할 캘린더가 선택되지 않았습니다. 설정에서 고르세요.';
        }

        const message = error instanceof Error ? error.message : String(error);

        if (MISSING_AUTOMATION_PATTERN.test(message)) {
            return 'Obsidian 이 캘린더를 제어할 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 자동화에서 Obsidian 의 캘린더 항목을 켜세요.';
        }

        if (MISSING_ACCESS_PATTERN.test(message)) {
            return 'Apple Calendar 를 읽을 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근 권한에서 Obsidian 을 허용하세요.';
        }

        return message;
    }
}
