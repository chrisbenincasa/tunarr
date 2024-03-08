import { Migration } from '@mikro-orm/migrations';

export class Migration20240308184352 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `plex_server_settings` add column `client_identifier` text null;');
  }

}
