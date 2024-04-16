import { Migration } from '@mikro-orm/migrations';

export class Migration20240416113447 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `channel` add column `guide_flex_title` text null;');
  }

}
