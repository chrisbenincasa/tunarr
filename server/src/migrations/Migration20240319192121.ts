import { Migration } from '@mikro-orm/migrations';

export class Migration20240319192121 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `program` drop column `custom_order`;');

    this.addSql('alter table `program` add column `artist_name` text null;');
    this.addSql('alter table `program` add column `album_name` text null;');
  }

}
