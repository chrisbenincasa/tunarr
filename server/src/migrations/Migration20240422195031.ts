import { Migration } from '@mikro-orm/migrations';

export class Migration20240422195031 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `program` rename column `season` to `season_number`;');
  }

}
