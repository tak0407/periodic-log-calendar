// Run with: npm run preview
//
// Draws the plugin's own React components into images, so a change to the view can
// be looked at instead of only reasoned about. Jest never paints, so without this
// the only way to see this plugin is to install it into Obsidian and look.
//
// The components, the calendar chain and the timeline parsing are the real ones;
// only the data is invented. NOTHING HERE MAY POINT AT REAL DATA: every event and
// note below is made up, the Apple Calendar repository is replaced by a stub that
// answers from the arrays in this file, and no vault is ever opened. A preview run
// cannot reach sqlite or a real note, and it must stay that way.
//
// Writes preview/*.html and, when Chrome is installed, preview/*.png.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(REPO, 'preview');

// The clock is nailed down before anything else loads. Two runs a minute apart
// would otherwise put the now-line in a different place and no two images could
// ever be compared — which is the whole point of drawing them.
const NOW = new Date('2026-09-17T12:34:00');
const RealDate = Date;

class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
        super(...(args.length ? args : [NOW]) as []);
    }

    static override now(): number {
        return NOW.getTime();
    }
}

globalThis.Date = FrozenDate as DateConstructor;

// React needs a DOM, and effects only run in one: the tabs, the notes list and the
// timeline all load in useEffect, so server rendering would only ever show the
// empty first frame. jsdom comes in with jest-environment-jsdom — no new dependency.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {pretendToBeVisual: true});
const window = dom.window;

[
    'window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'DocumentFragment',
    'Event', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
].forEach((name) => {
    if (!(name in globalThis)) {
        (globalThis as Record<string, unknown>)[name] = (window as unknown as Record<string, unknown>)[name];
    }
});

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Everything below has to load after the clock and the DOM are in place.
const React = (await import('react')).default;
const {act} = await import('react');
const {createRoot} = await import('react-dom/client');
const {CalendarComponent} = await import('src/presentation/components/calendar.component');
const {ViewModelsContext} = await import('src/presentation/context/view-model.context');
const {DefaultCalendarViewModel} = await import('src/presentation/view-models/default.calendar-view-model');
const {DefaultCalendarService} = await import('src/presentation/services/default.calendar-service');
const {DefaultDateManagerFactory} = await import('src/business/factories/default.date-manager-factory');
const {DefaultDateRepositoryFactory} = await import('src/infrastructure/factories/default.date-repository-factory');
const {DefaultDateParserFactory} = await import('src/infrastructure/factories/default.date-parser-factory');
const {RepositoryTimelineManager} = await import('src/business/managers/repository.timeline-manager');
const {DefaultTimelineViewModel} = await import('src/presentation/view-models/default.timeline-view-model');
const {DEFAULT_PLUGIN_SETTINGS} = await import('src/domain/settings/plugin.settings');
const {PeriodType} = await import('src/domain/models/period.model');

type Period = import('src/domain/models/period.model').Period;
type Note = import('src/domain/models/note.model').Note;
type CalendarEventRow = import('src/domain/models/timeline.model').CalendarEventRow;
type TimelineMode = import('src/domain/models/timeline.model').TimelineMode;
type CalendarEventRepository = import('src/infrastructure/contracts/calendar-event-repository').CalendarEventRepository;
type ViewModels = import('src/presentation/context/view-model.context').ViewModelsContext;

const DAY = '2026-09-17';
const NO_OP = async (): Promise<void> => {};

// ---------------------------------------------------------------------------
// Synthetic data. Invented, and only ever invented — see the notice at the top.
// ---------------------------------------------------------------------------

const event = (calendar: string, summary: string, from: string, to: string): CalendarEventRow =>
    <CalendarEventRow>{calendar: calendar, summary: summary, starts_at: DAY + ' ' + from, ends_at: DAY + ' ' + to};

const {locationCalendar, focusCalendar} = DEFAULT_PLUGIN_SETTINGS.timelineSettings;
const planCalendar = '내 계획';

const LOG_ROWS: CalendarEventRow[] = [
    event(locationCalendar, '집', '00:00:00', '07:43:00'),
    event(locationCalendar, '이동', '07:43:00', '08:31:00'),
    event(locationCalendar, '회사', '08:31:00', '12:07:00'),
    event(locationCalendar, '식당', '12:07:00', '12:30:00'),
    // An open stay: stored with no end, so the model runs it up to the frozen now
    // and marks it 진행 중. Nothing else in a still frame shows that state.
    event(locationCalendar, '회사', '12:30:00', '12:30:00'),
    event(focusCalendar, '독서', '07:05:00', '07:38:00'),
    event(focusCalendar, '코딩', '09:20:00', '11:40:00'),
    event(focusCalendar, '회의', '10:30:00', '11:30:00'),
    event(focusCalendar, '짧은 메모', '11:50:00', '11:51:00'),
];

const PLAN_ROWS: CalendarEventRow[] = [
    event(planCalendar, '아침 루틴', '07:00:00', '08:00:00'),
    event(planCalendar, '집중 블록', '09:00:00', '12:00:00'),
    event(planCalendar, '겹치는 일정', '10:30:00', '11:30:00'),
    event(planCalendar, '점심', '12:00:00', '13:00:00'),
    event(planCalendar, '짧은 확인', '14:00:00', '14:02:00'),
    event(planCalendar, '주간 회의', '15:00:00', '16:00:00'),
    event(planCalendar, '운동', '18:30:00', '19:30:00'),
];

const note = (name: string, path: string): Note => <Note>{
    createdOn: <Period>{date: NOW, name: '17', type: PeriodType.Day},
    createdOnProperty: null,
    displayDate: DAY,
    name: name,
    path: path,
    properties: new Map<string, string>(),
};

const NOTES: Note[] = [
    note('예시 노트', 'preview/예시 노트.md'),
    note('Example note', 'preview/Example note.md'),
    note('세 번째 예시', 'preview/세 번째 예시.md'),
];

// ---------------------------------------------------------------------------
// View models. The calendar and the timeline are the real ones over stub data;
// the note ones are stubs, because a vault is exactly what must not be opened.
// ---------------------------------------------------------------------------

class PreviewEventRepository implements CalendarEventRepository {
    constructor(
        private readonly rows: CalendarEventRow[],
        private readonly failure: Error | null,
    ) {

    }

    public isSupported(): boolean {
        return true;
    }

    public getEventsForDay(_day: Date, _mode: TimelineMode, _settings: unknown): Promise<CalendarEventRow[]> {
        return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.rows);
    }
}

const periodNoteViewModel = {
    updateSettings: () => {},
    // A note on a couple of days, so the has-note marker is in the shot.
    hasPeriodicNote: async (period: Period): Promise<boolean> => [15, 17, 22].includes(period.date.getDate()),
    openNote: NO_OP,
    openNoteInHorizontalSplitView: NO_OP,
    openNoteInVerticalSplitView: NO_OP,
    deleteNote: NO_OP,
};

// The count on a day and the list under the calendar are the same notes, so the
// day that is opened counts the list it is about to show.
const dayNoteViewModel = (notes: Note[]): typeof periodNoteViewModel & {getNoteCount: (period: Period) => Promise<number>} => ({
    ...periodNoteViewModel,
    getNoteCount: async (period: Period): Promise<number> => period.date.toDateString() === NOW.toDateString()
        ? notes.length
        : ({16: 2}[period.date.getDate()] ?? 0),
});

const viewModels = (notes: Note[], rows: CalendarEventRow[], failure: Error | null): ViewModels => {
    const dateManagerFactory = new DefaultDateManagerFactory(
        new DefaultDateRepositoryFactory(new DefaultDateParserFactory()),
    );
    const calendarViewModel = new DefaultCalendarViewModel(new DefaultCalendarService(dateManagerFactory));
    calendarViewModel.initialize(DEFAULT_PLUGIN_SETTINGS, dateManagerFactory.getManager().getCurrentDay());

    const timelineViewModel = new DefaultTimelineViewModel(
        new RepositoryTimelineManager(new PreviewEventRepository(rows, failure)),
    );
    timelineViewModel.updateSettings(DEFAULT_PLUGIN_SETTINGS);

    return <ViewModels>{
        calendarViewModel: calendarViewModel,
        dailyNoteViewModel: dayNoteViewModel(notes),
        weeklyNoteViewModel: periodNoteViewModel,
        monthlyNoteViewModel: periodNoteViewModel,
        quarterlyNoteViewModel: periodNoteViewModel,
        yearlyNoteViewModel: periodNoteViewModel,
        notesViewModel: {
            initializeCallbacks: () => {},
            loadNotes: async (): Promise<Note[]> => notes,
            openNote: NO_OP,
            openNoteInHorizontalSplitView: NO_OP,
            openNoteInVerticalSplitView: NO_OP,
            deleteNote: NO_OP,
        },
        timelineViewModel: timelineViewModel,
    };
};

// ---------------------------------------------------------------------------
// The screens.
// ---------------------------------------------------------------------------

const NOTES_TAB = 0;
const LOG_TAB = 1;
const PLAN_TAB = 2;

interface Screen {
    name: string;
    tab: number;
    notes: Note[];
    rows: CalendarEventRow[];
    failure: Error | null;
    // A string the drawn markup has to contain. It makes a preview run a smoke
    // test too: if a screen silently stops drawing, the run fails instead of
    // quietly writing a picture of nothing.
    expects: string;
}

const SCREENS: Screen[] = [
    {name: 'notes', tab: NOTES_TAB, notes: NOTES, rows: [], failure: null, expects: '예시 노트'},
    {name: 'notes-none', tab: NOTES_TAB, notes: [], rows: [], failure: null, expects: 'dnc-tab active'},
    {name: 'log', tab: LOG_TAB, notes: NOTES, rows: LOG_ROWS, failure: null, expects: 'dnc-timeline-now'},
    {name: 'plan', tab: PLAN_TAB, notes: NOTES, rows: PLAN_ROWS, failure: null, expects: '겹치는 일정'},
    {name: 'plan-empty', tab: PLAN_TAB, notes: NOTES, rows: [], failure: null, expects: 'dnc-timeline-grid'},
    // 'unable to open database' is what a missing full-disk-access read comes back
    // with, so this draws the message a first-time user actually meets.
    {name: 'log-denied', tab: LOG_TAB, notes: NOTES, rows: [], failure: new Error('unable to open database'), expects: 'dnc-timeline-error'},
];

// The notes, the day markers and the timeline all arrive through promises, and a
// render that is captured between two of them is a different picture each run.
// Draining the queue inside act() is what makes two runs agree.
const settle = (): Promise<void> => act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
});

const click = (host: Element, selector: string, index = 0): Promise<void> => act(async () => {
    const targets = host.querySelectorAll(selector);
    const target = targets[index];

    if (!target) {
        throw new Error('nothing to click for ' + selector + '[' + index + ']');
    }

    (target as HTMLElement).click();
});

async function draw(screen: Screen): Promise<string> {
    const host = window.document.createElement('div');
    window.document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
        root.render(React.createElement(
            ViewModelsContext.Provider,
            {value: viewModels(screen.notes, screen.rows, screen.failure)},
            React.createElement(CalendarComponent),
        ));
    });

    // Today, because it is the one day the grid marks and the one the now-line
    // belongs to. Every screen shows the same date, so only the tab differs.
    await settle();
    await click(host, '#today');
    await click(host, '.dnc-tab', screen.tab);
    await settle();

    const markup = host.innerHTML;

    await act(async () => root.unmount());
    host.remove();

    if (!markup.includes(screen.expects)) {
        throw new Error(screen.name + ' drew without ' + screen.expects);
    }

    return markup;
}

// ---------------------------------------------------------------------------
// The page around it. Obsidian's own variables are not here, so the two themes
// stand in for them — close enough to read the view by, never the real thing.
// ---------------------------------------------------------------------------

const THEMES: Record<string, string> = {
    light: `--background-primary:#ffffff;--background-primary-alt:#fafafa;--background-secondary:#f2f3f5;
    --background-modifier-border:#e0e0e0;--background-modifier-hover:#ebebeb;--background-modifier-active-hover:#d8dce8;
    --text-normal:#222222;--text-muted:#5c5c5c;--text-faint:#999999;--text-error:#c0392b;
    --interactive-normal:#f2f3f5;--interactive-accent:#5b6bc0;--text-accent:#5b6bc0;`,
    dark: `--background-primary:#1e1e1e;--background-primary-alt:#161616;--background-secondary:#262626;
    --background-modifier-border:#3a3a3a;--background-modifier-hover:#2f2f2f;--background-modifier-active-hover:#3d4463;
    --text-normal:#dadada;--text-muted:#9a9a9a;--text-faint:#6b6b6b;--text-error:#e35d4f;
    --interactive-normal:#2a2a2a;--interactive-accent:#7c8cdb;--text-accent:#7c8cdb;`,
};

const page = (body: string, theme: string): string => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../styles.css">
<style>
  :root{${THEMES[theme]}
    --font-ui-smaller:12px;--font-ui-small:13px;--font-ui-medium:15px;
    --font-light:300;--font-medium:500;--font-semibold:600}
  /* Obsidian sets both of these app-wide, and the view is built expecting them:
     without the border box the calendar is a few pixels wider than the leaf, and
     without the padding everything reads as if it were glued to the frame. */
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%;background:var(--background-primary);
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;color:var(--text-normal)}
  .view-content{padding:12px}
  /* In Obsidian the leaf gives the view its height. Here nothing does, and without
     this the panel sizes to its content and the shot stops looking like the real
     thing — the tabs would scroll away with the calendar instead of staying put. */
  .workspace-leaf-content,.view-content{height:100%}
</style>
<div class="workspace-leaf-content" data-type="periodic-log-calendar"><div class="view-content">${body}</div></div>`;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// A sidebar leaf, roughly: the width the view actually gets, and tall enough that
// the timeline does not need scrolling to be read. Headless Chrome refuses to lay
// out narrower than 500px, and a window narrower than that is drawn wide and then
// cropped — which silently cut the Sunday column off the first images made here.
const SIZE = '520,1200';

fs.mkdirSync(OUT, {recursive: true});

const made: string[] = [];

for (const screen of SCREENS) {
    const markup = await draw(screen);

    for (const theme of Object.keys(THEMES)) {
        const name = screen.name + '-' + theme;
        fs.writeFileSync(path.join(OUT, name + '.html'), page(markup, theme));
        made.push(name);
    }
}

if (!fs.existsSync(CHROME)) {
    console.log('wrote ' + made.length + ' pages to preview/. Chrome not found, so open them by hand.');
    process.exit(0);
}

made.forEach((name) => {
    execFileSync(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
        '--window-size=' + SIZE,
        '--screenshot=' + path.join(OUT, name + '.png'),
        'file://' + path.join(OUT, name + '.html'),
    ], {stdio: 'ignore'});
});

console.log('preview/: ' + made.map((name) => name + '.png').join(' '));
console.log('Look at them before reporting that the view works.');
