import type { Kysely } from 'kysely';
import { CompiledQuery } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = OFF'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = ON'));

    /**
     * create table `channel_filler_show__temp_alter` (
     *  `filler_show_uuid` text not null,
     * `channel_uuid` text not null,
     * `weight` integer not null,
     * `cooldown` integer not null,
     * constraint `channel_filler_show_filler_show_uuid_foreign` foreign key(`filler_show_uuid`) references `filler_show`(`uuid`) on update cascade,
     * constraint `channel_filler_show_channel_uuid_foreign` foreign key(`channel_uuid`) references `channel`(`uuid`) on delete cascade on update cascade,
     * primary key (`filler_show_uuid`,
     * `channel_uuid`));
     */

    // await db.schema
    //   .createTable('channel_filler_show')
    //   .addColumn('channel_uuid', 'text', (col) => col.notNull())
    //   .addColumn('filler_show_uuid', 'text', (col) => col.notNull())
    //   .addColumn('weight', 'integer', (col) => col.notNull())
    //   .addColumn('cooldown', 'integer', (col) => col.notNull())
    //   .addForeignKeyConstraint(
    //     'channel_filler_show_channel_uuid_foreign',
    //     ['channel_uuid'],
    //     'channel',
    //     ['uuid'],
    //     (cb) => cb.onDelete('cascade').onUpdate('cascade'),
    //   )
    //   .addForeignKeyConstraint(
    //     'channel_filler_show_filler_show_uuid_foreign',
    //     ['filler_show_uuid'],
    //     'custom_show',
    //     ['uuid'],
    //     (cb) => cb.onDelete('cascade').onUpdate('cascade'),
    //   )
    //   .addPrimaryKeyConstraint('primary_key', [
    //     'channel_uuid',
    //     'filler_show_uuid',
    //   ])
    //   .execute();

    // this.addSql(
    //   'insert into `channel_filler_show__temp_alter` select * from `channel_filler_show`;',
    // );
    // this.addSql('drop table `channel_filler_show`;');
    // this.addSql(
    //   'alter table `channel_filler_show__temp_alter` rename to `channel_filler_show`;',
    // );
    // this.addSql(
    //   'create index `channel_filler_show_filler_show_uuid_index` on `channel_filler_show` (`filler_show_uuid`);',
    // );
    // this.addSql(
    //   'create index `channel_filler_show_channel_uuid_index` on `channel_filler_show` (`channel_uuid`);',
    // );

    // this.addSql('pragma foreign_keys = on;');
    // this.addSql('PRAGMA defer_foreign_keys = OFF;');
    await db.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'));
    await db.executeQuery(CompiledQuery.raw('PRAGMA defer_foreign_keys = OFF'));
  },
};
