import { afterEach, describe, expect, test, vi } from 'vitest';
import { ScanLibrariesTask } from '../tasks/ScanLibrariesTask.ts';
import { SyncCollectionsTask } from '../tasks/SyncCollectionsTask.ts';
import { SyncCustomShowsTask } from '../tasks/SyncCustomShowsTask.ts';
import { scheduleLibraryScanJobs } from './libraryScanSchedule.ts';
import { GlobalScheduler } from './Scheduler.ts';

vi.mock('../container.ts', () => ({ container: { get: vi.fn() } }));

const TaskIds = [
  ScanLibrariesTask.ID,
  SyncCollectionsTask.ID,
  SyncCustomShowsTask.ID,
];

const jobsFor = (id: string) => GlobalScheduler.getScheduledJobs(id) ?? [];

describe('scheduleLibraryScanJobs', () => {
  afterEach(() => {
    for (const id of TaskIds) {
      GlobalScheduler.clearTasks(id);
    }
  });

  test('schedules the scan and both syncs on the same cron', () => {
    scheduleLibraryScanJobs({
      type: 'days',
      daysOfWeek: [1],
      hour: 3,
      minute: 15,
    });

    for (const id of TaskIds) {
      const jobs = jobsFor(id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.schedule).toBe('0 15 3 * * 1');
      const next = jobs[0]?.nextExecution();
      expect(next?.getDay()).toBe(1);
      expect(next?.getHours()).toBe(3);
      expect(next?.getMinutes()).toBe(15);
    }
  });

  test('replaces existing jobs instead of adding to them', () => {
    scheduleLibraryScanJobs({ type: 'interval', hours: 6, minute: 30 });
    scheduleLibraryScanJobs({ type: 'interval', hours: 12, minute: 0 });

    for (const id of TaskIds) {
      const jobs = jobsFor(id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.schedule).toBe('0 0 */12 * * *');
    }
  });

  test('turning scans off removes every job', () => {
    scheduleLibraryScanJobs({ type: 'interval', hours: 6, minute: 30 });
    scheduleLibraryScanJobs({ type: 'off' });

    for (const id of TaskIds) {
      expect(jobsFor(id)).toEqual([]);
    }
  });

  test('schedules nothing for an invalid cron expression', () => {
    scheduleLibraryScanJobs({ type: 'interval', hours: 6, minute: 30 });
    scheduleLibraryScanJobs({ type: 'cron', cron: 'not a cron' });

    for (const id of TaskIds) {
      expect(jobsFor(id)).toEqual([]);
    }
  });
});
