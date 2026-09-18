import {TimelineColumn, TimelineViewModel} from 'src/presentation/contracts/timeline.view-model';
import {TimelineManager} from 'src/business/contracts/timeline.manager';
import {HourRange, TimelineMode} from 'src/domain/models/timeline.model';
import {PluginSettings} from 'src/domain/settings/plugin.settings';
import {DEFAULT_TIMELINE_SETTINGS, TimelineSettings, viewRange} from 'src/domain/settings/timeline.settings';
import {NO_PLAN_CALENDAR} from 'src/infrastructure/repositories/sqlite.calendar-event-repository';

const MISSING_ACCESS_PATTERN = /authorization denied|unable to open database|not authorized|no such file/i;

export class DefaultTimelineViewModel implements TimelineViewModel {
    private settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS;

    constructor(
        private readonly timelineManager: TimelineManager,
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

    // Both sides are asked for at once and each keeps its own failure, so a missing
    // plan calendar still leaves the recorded side on screen.
    public loadDay(date: Date): Promise<TimelineColumn[]> {
        return Promise.all([
            this.loadColumn(date, TimelineMode.Actual, '기록'),
            this.loadColumn(date, TimelineMode.Plan, '계획'),
        ]);
    }

    private async loadColumn(date: Date, mode: TimelineMode, label: string): Promise<TimelineColumn> {
        try {
            const day = await this.timelineManager.getDay(date, mode, this.settings);
            return <TimelineColumn>{mode: mode, label: label, day: day, error: null};
        } catch (error) {
            return <TimelineColumn>{mode: mode, label: label, day: null, error: this.messageFor(error)};
        }
    }

    private messageFor(error: unknown): string {
        if ((<{code?: string}>error)?.code === NO_PLAN_CALENDAR) {
            return '계획에 사용할 캘린더가 선택되지 않았습니다. 설정에서 고르세요.';
        }

        const message = error instanceof Error ? error.message : String(error);

        if (MISSING_ACCESS_PATTERN.test(message)) {
            return 'Apple Calendar 를 읽을 권한이 없습니다. 시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근 권한에서 Obsidian 을 허용하세요.';
        }

        return message;
    }
}
