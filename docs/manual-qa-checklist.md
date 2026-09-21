# Manual QA Checklist

This checklist validates system-edge integration code that is explicitly excluded from automated testing per architectural decision: Obsidian adapters (`src/infrastructure/obsidian/*adapter.ts`) and plugin lifecycle (`src/daily-note-calendar.plugin.ts`, `src/daily-note-calendar.plugin-setting-tab.ts`).

**Why manual testing?** These components sit at the Obsidian API boundary. Mocking the Obsidian API creates brittle tests tied to implementation details that could change. Manual validation in a running Obsidian instance provides higher confidence.

---

## Pre-Release Validation

Run this checklist before every release or after changes to adapters, plugin lifecycle, or Obsidian API integration.

### Environment Setup
- [ ] Obsidian version: _________ (document version used for testing)
- [ ] Plugin version: _________ (from `manifest.json`)
- [ ] Test vault location: _________ (use dedicated test vault, not production notes)

---

## 1. Plugin Lifecycle

### 1.1 Plugin Loading
- [ ] Plugin loads without errors in Obsidian console
- [ ] No TypeScript compilation errors
- [ ] Plugin appears in Settings → Community plugins
- [ ] Plugin can be enabled/disabled without errors

### 1.2 View Registration
- [ ] Calendar view automatically opens on plugin load
- [ ] Calendar view appears in right sidebar
- [ ] Calendar view can be closed without errors
- [ ] Calendar view can be reopened by toggling plugin or restarting Obsidian

### 1.3 Command Registration
Verify all commands appear in command palette (Ctrl+P / Cmd+P):
- [ ] "Open today's note"
- [ ] "Open yesterday's note"
- [ ] "Open tomorrow's note"
- [ ] "Open weekly note"
- [ ] "Navigate to current week"
- [ ] "Navigate to next week"
- [ ] "Navigate to previous week"
- [ ] "Navigate to next month"
- [ ] "Navigate to previous month"
- [ ] "Display in calendar" (when a note is active)

---

## 2. Settings Persistence (`ObsidianSettingsAdapter`)

### 2.1 Settings Tab
- [ ] Settings tab appears under plugin settings
- [ ] All settings sections render without errors:
  - [ ] General settings
  - [ ] Display notes settings
  - [ ] Daily notes settings
  - [ ] Weekly notes settings
  - [ ] Monthly notes settings
  - [ ] Quarterly notes settings
  - [ ] Yearly notes settings

### 2.2 Settings Save/Load
- [ ] Change a setting (e.g., note folder path)
- [ ] Close Obsidian completely
- [ ] Reopen Obsidian
- [ ] Verify setting persisted correctly

### 2.3 Default Settings Fallback
- [ ] Delete plugin data file (`.obsidian/plugins/daily-note-calendar/data.json`)
- [ ] Reload plugin
- [ ] Verify default settings are applied
- [ ] Settings tab shows default values

---

## 3. File Operations (`ObsidianFileAdapter`)

### 3.1 File Existence Check
- [ ] Create a test note manually: `test-note.md`
- [ ] Open calendar, navigate to a date
- [ ] Note indicator shows correctly for days with notes
- [ ] Delete `test-note.md`
- [ ] Note indicator disappears after refresh

### 3.2 File Creation
- [ ] Click on a day without a note (with Cmd/Ctrl to create)
- [ ] Verify note is created in configured folder
- [ ] Verify note has correct name format per settings
- [ ] Verify note content matches template (if configured)

### 3.3 Folder Creation
- [ ] Configure note folder to `test-folder/subfolder` (non-existent path)
- [ ] Create a new note
- [ ] Verify folder structure is created automatically
- [ ] Note is created in correct location

### 3.4 File Opening - Current Tab
- [ ] Create or select a test note
- [ ] Click day in calendar (default click)
- [ ] Verify note opens in current tab
- [ ] Verify previous tab content is replaced

### 3.5 File Opening - Horizontal Split
- [ ] Click day with Cmd+Alt / Ctrl+Alt (or configured modifier)
- [ ] Verify note opens in horizontal split
- [ ] Verify original pane content is preserved

### 3.6 File Opening - Vertical Split
- [ ] Click day with Cmd+Shift / Ctrl+Shift (or configured modifier)
- [ ] Verify note opens in vertical split
- [ ] Verify original pane content is preserved

### 3.7 File Deletion
- [ ] Right-click on a day with a note → "Delete note"
- [ ] Verify Obsidian deletion prompt appears
- [ ] Confirm deletion
- [ ] Verify note is deleted from vault
- [ ] Verify note indicator disappears from calendar

---

## 4. Note Operations (`ObsidianNoteAdapter`)

### 4.1 Active Note Retrieval
- [ ] Open a note in editor
- [ ] Execute "Display in calendar" command
- [ ] Verify calendar navigates to correct date
- [ ] Verify correct period is selected

### 4.2 Notes Collection (Display Notes Feature)
- [ ] Create multiple notes with front matter:
  ```yaml
  ---
  created: 2026-04-08
  ---
  ```
- [ ] Click on April 8, 2026 in calendar
- [ ] Verify all notes with that creation date appear in notes panel
- [ ] Verify note names, paths, and dates display correctly

### 4.3 Front Matter Parsing
Test various front matter formats:
- [ ] `created: 2026-04-08` (ISO date)
- [ ] `created: 2026-04-08T10:30:00` (ISO datetime)
- [ ] `created: [[2026-04-08]]` (wikilink format)
- [ ] Verify all formats parse correctly
- [ ] Notes without `created` field are ignored (not shown)

### 4.4 Metadata Cache Handling
- [ ] Create note without front matter
- [ ] Add front matter with `created` field
- [ ] Without reloading Obsidian, click date in calendar
- [ ] Verify metadata cache updates and note appears
- [ ] (May require manual cache refresh depending on Obsidian version)

---

## 5. Template Resolution

### 5.1 Template File Path
- [ ] Configure template file path in settings
- [ ] Create new note from calendar
- [ ] Verify template content is inserted
- [ ] Verify variables are parsed (e.g., `{{date}}`, `{{title}}`)

### 5.2 Template Variables
Configure template with variables:
```markdown
---
created: {{date:YYYY-MM-DD}}
---
# {{title}}

Today is {{date:dddd, MMMM Do YYYY}}
```
- [ ] Create note for 2026-04-08
- [ ] Verify `{{date}}` resolves to correct format
- [ ] Verify `{{title}}` resolves correctly
- [ ] Verify all configured variables parse

### 5.3 Missing Template Handling
- [ ] Configure template path to non-existent file
- [ ] Create new note from calendar
- [ ] Verify graceful fallback (empty note or default content)
- [ ] Verify no error thrown

---

## 6. Cross-Platform Validation

### 6.1 Windows
- [ ] File paths with `\` separators work correctly
- [ ] Modifier keys (Ctrl, Alt, Shift) work as expected
- [ ] File creation/deletion works

### 6.2 macOS
- [ ] File paths with `/` separators work correctly
- [ ] Modifier keys (Cmd, Option, Shift) work as expected
- [ ] File creation/deletion works

### 6.3 Linux
- [ ] File paths with `/` separators work correctly
- [ ] Modifier keys (Ctrl, Alt, Shift) work as expected
- [ ] File creation/deletion works

---

## 7. Error Handling

### 7.1 Vault Permissions
- [ ] Make note file read-only
- [ ] Try to delete note from calendar
- [ ] Verify error message shows to user

### 7.2 Invalid Configuration
- [ ] Configure invalid date format in settings
- [ ] Try to create note
- [ ] Verify graceful error handling

### 7.3 Missing Folder
- [ ] Configure note folder that requires parent creation
- [ ] Verify parent folders created automatically

---

## 8. Performance

### 8.1 Large Vault
- [ ] Test in vault with 5000+ notes
- [ ] Verify calendar loads without significant lag
- [ ] Verify note indicators load reasonably fast
- [ ] Verify metadata cache queries don't freeze UI

### 8.2 Memory Leaks
- [ ] Open/close calendar view 50 times
- [ ] Check Obsidian memory usage (via OS task manager)
- [ ] Verify no significant memory growth

---

## 9. Regression Tests (After Obsidian Updates)

When a new Obsidian version is released:
- [ ] Verify all commands still work
- [ ] Verify all file operations work
- [ ] Verify settings persist correctly
- [ ] Check Obsidian changelog for API changes affecting:
  - `Vault` API
  - `Workspace` API
  - `MetadataCache` API
  - `TFile` / `TFolder` classes
  - Plugin lifecycle hooks

---

## Test Results

**Date:** _______________  
**Tester:** _______________  
**Obsidian Version:** _______________  
**Plugin Version:** _______________  
**Pass Rate:** _____ / _____ (total checked)  

**Failures or Issues Found:**
```
(Document any failures, unexpected behavior, or edge cases discovered)
```

**Notes:**
```
(Additional observations, suggestions, or context)
```

---

## Why This Approach?

**Automated tests cover:**
- Business logic (managers, services, repositories, parsers)
- Presentation logic (view models, command handlers, components)
- Domain models and utilities

**Manual tests cover:**
- Obsidian API integration (adapters)
- Plugin lifecycle (registration, settings tab)
- Real vault operations
- Cross-platform behavior
- Performance under load

This separation keeps automated tests fast, maintainable, and decoupled from Obsidian implementation details, while manual QA validates real-world integration correctness.

---

## Log & plan tab (fork only)

The Apple Calendar adapter shells out to `sqlite3`, so it is excluded from automated
testing for the same reason as the Obsidian adapters. Everything below needs a real
macOS machine with real calendars.

### Platform and permissions
- [ ] On macOS desktop with Full Disk Access granted, the tab draws the day
- [ ] With Full Disk Access revoked, the tab explains that the permission is missing and does not throw
- [ ] The plugin does not appear at all in the mobile plugin list (`isDesktopOnly`)

### Reading, and only reading
- [ ] `Calendar.sqlitedb` modification time is unchanged after opening the tab many times
      (`stat -f %m ~/Library/Group\ Containers/group.com.apple.calendar/Calendar.sqlitedb` before and after)
- [ ] Apple Calendar shows no new, changed or deleted events after a session of only reading the tab
- [ ] After an edit, the change is in Apple Calendar itself and survives quitting and reopening
      Calendar — the plugin wrote through the app, not into the database

### The day itself
- [ ] Records appear in the left column and plans in the right, on the same hour rows
- [ ] A record that crosses an hour boundary is named once, on the row it starts on
- [ ] Two overlapping records sit side by side rather than hiding one another
- [ ] A stay still in progress runs up to the current time
- [ ] Two stays in the same place a minute apart are drawn as one
- [ ] A record crossing midnight stops at the bottom of the day and continues on the next day
- [ ] Selecting a different date redraws both columns

### Editing
- [ ] Nothing in the log tab can be dragged out, dragged around or pressed to edit
- [ ] Dragging across empty time in the plan tab opens the editor on the span that was drawn, rounded to five minutes
- [ ] The editor stands on the grid against the row it is about, and the rows behind it stay readable
- [ ] Escape and 취소 close the editor without writing
- [ ] The span is drawn on the grid while dragging and disappears when the pointer is released
- [ ] Dragging upwards or to the left gives the same span as dragging the other way
- [ ] Letting go of the pointer outside the grid makes nothing
- [ ] Clicking without dragging opens no editor
- [ ] Saving an event puts it in Apple Calendar at the right time, on the right calendar, and the tab redraws with it
- [ ] The first edit of a session asks to control Calendar; refusing it shows the message pointing at Automation and leaves the day on screen
- [ ] With several plan calendars set, the editor offers the choice; with one it does not
- [ ] Pressing a record opens it for editing with its own title, date and times, and offers no calendar choice
- [ ] Changing the title and the times writes both, and the tab redraws
- [ ] Changing the date moves the event to that day: it leaves the day on screen and is there when that day is selected
- [ ] Deleting removes it from Apple Calendar
- [ ] Closing the editor with escape changes nothing
- [ ] A record crossing midnight cannot be pressed or dragged, and is left to the Calendar app
- [ ] An event with a quote or a backslash in its title saves with the title intact
- [ ] An event typed as 23:30 to 00:30 is written as reaching into the next day
- [ ] A start and an end typed the same are refused rather than written as a whole day

### Dragging a record
- [ ] Dragging a record by its middle moves it and keeps its length, in Apple Calendar too
- [ ] Dragging it by its left or right end moves that end alone
- [ ] The proposed time is drawn while dragging and the record settles there afterwards
- [ ] A moved or resized record keeps its title — including one that had none, which is not renamed to 제목 없음
- [ ] Dragging a record back to where it started writes nothing and opens the editor
- [ ] A record that was dragged does not also open the editor when the pointer comes back down on it
- [ ] An end cannot be dragged past the other end, and a record cannot be dragged past midnight
- [ ] Letting go outside the grid leaves the record where it was

### Settings
- [ ] Changing a calendar name in Settings → Log & plan changes what the tab reads
- [ ] A calendar name containing an apostrophe works
- [ ] Clearing the plan calendars makes the plan column point at the settings, and leaves the record column readable
- [ ] Changing the first and last hour changes which rows are drawn

### Clicking a day
- [ ] A plain click on a day selects it and opens no note; the tabs below show that day
- [ ] A double-click opens (or creates) the daily note
- [ ] An `alt`- or `⌘`-click opens the daily note on the first click
- [ ] With **Open the daily note on click** on, a plain click opens the note and a `shift`-click only selects
- [ ] With it on, a double-click does not open the note a second time
- [ ] Clicking a week number, month, quarter or year opens that note and does not change which day the tabs below show

### Nothing else moved
- [ ] The Notes tab is the one selected when the calendar view opens
- [ ] Notes still list, open, open in split views and delete exactly as before
- [ ] Periodic note creation and navigation are unaffected
- [ ] With the original `daily-note-calendar` also installed and enabled, both plugins load and both sidebar views work
