import { Migration } from '@mikro-orm/migrations';

export class Migration20240411104034 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'update `program` set `external_key` = `plex_rating_key` where `plex_rating_key` is not null;',
    );
  }
}
