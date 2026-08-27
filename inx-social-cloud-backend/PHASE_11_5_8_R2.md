# Phase 11.5.8 R2 — Dashboard Isolation and Simplification Hotfix

This hotfix corrects the Dashboard display rule introduced in Phase 11.5.8 and simplifies Dashboard into a professional status overview.

## Corrected

- Dashboard is now hidden whenever another menu is selected.
- Social Agent, Scheduler, Calendar, Analytics, Activity Logs, Settings and Connected Pages render without Dashboard content above them.
- Removed file import, folder import, schedule-check and connection-diagnostic controls from Dashboard.
- Dashboard now shows only active Page status, scheduled and queued totals, content-library totals, current publishing progress, the real content queue and compact calendar.
- Primary work remains inside Scheduler, Social Agent, Calendar and Connected Pages.

No database migration, Railway variable, Mac gateway change or Ollama restart is required.
