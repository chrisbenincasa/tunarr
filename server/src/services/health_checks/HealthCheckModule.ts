import { FfmpegDebugLoggingHealthCheck } from '@/services/health_checks/FfmpegDebugLoggingHealthCheck.js';
import { FfmpegVersionHealthCheck } from '@/services/health_checks/FfmpegVersionHealthCheck.js';
import { HardwareAccelerationHealthCheck } from '@/services/health_checks/HardwareAccelerationHealthCheck.js';
import type { HealthCheck } from '@/services/health_checks/HealthCheck.js';
import { MissingProgramAssociationsHealthCheck } from '@/services/health_checks/MissingProgramAssociationsHealthCheck.js';
import { MissingSeasonNumbersHealthCheck } from '@/services/health_checks/MissingSeasonNumbersHealthCheck.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';

const HealthCheckModule = new ContainerModule((bind) => {
  bind<HealthCheck>(KEYS.HealthCheck).to(FfmpegDebugLoggingHealthCheck);
  bind<HealthCheck>(KEYS.HealthCheck).to(MissingProgramAssociationsHealthCheck);
  bind<HealthCheck>(KEYS.HealthCheck).to(FfmpegVersionHealthCheck);
  bind<HealthCheck>(KEYS.HealthCheck).to(HardwareAccelerationHealthCheck);
  bind<HealthCheck>(KEYS.HealthCheck).to(MissingSeasonNumbersHealthCheck);
});

export { HealthCheckModule };
