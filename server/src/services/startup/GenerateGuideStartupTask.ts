import { injectable } from 'inversify';
import { FixerRunner } from '../../tasks/fixers/FixerRunner.ts';
import { UpdateXmlTvTask } from '../../tasks/UpdateXmlTvTask.ts';
import { GlobalScheduler } from '../Scheduler.ts';
import { SimpleStartupTask } from './IStartupTask.ts';
import { ScheduleJobsStartupTask } from './ScheduleJobsStartupTask.ts';

@injectable()
export class GenerateGuideStartupTask extends SimpleStartupTask {
  id = GenerateGuideStartupTask.name;
  dependencies = [FixerRunner.name, ScheduleJobsStartupTask.name];

  getPromise(): Promise<void> {
    return GlobalScheduler.runScheduledJobNow(UpdateXmlTvTask.ID);
  }
}
