import { makeMigrationFromSqlString } from './util.ts';

const expr = String.raw`
ALTER TABLE "transcode_config" ADD "disable_hardware_decoder" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "transcode_config" ADD "disable_hardware_encoding" integer DEFAULT false;--> statement-breakpoint
ALTER TABLE "transcode_config" ADD "disable_hardware_filters" integer DEFAULT false;
`;

export default makeMigrationFromSqlString(expr);
