export default {
  async up(): Promise<void> {
    // DROP INDEX IF EXISTS `filler_show_content_filler_show_uuid_program_uuid_index_unique`;
    // await db.schema
    //   .dropIndex(
    //     'filler_show_content_filler_show_uuid_program_uuid_index_unique',
    //   )
    //   .ifExists()
    //   .execute();
    // ALTER TABLE `filler_show_content` DROP COLUMN  `index`;
    // await db.schema
    //   .alterTable('filler_show_content')
    //   .dropColumn('index')
    //   .execute();
    // // ALTER TABLE `filler_show_content` ADD COLUMN `index` integer not null;
    // await db.schema
    //   .alterTable('filler_show_content')
    //   .addColumn('index', 'integer', (col) => col.notNull())
    //   .execute();
    // CREATE UNIQUE INDEX `filler_show_content_filler_show_uuid_program_uuid_index_unique` on `filler_show_content` (`filler_show_uuid`, `program_uuid`, `index`);
    // await db.schema
    //   .createIndex(
    //     'filler_show_content_filler_show_uuid_program_uuid_index_unique',
    //   )
    //   .on('filler_show_content')
    //   .columns(['filler_show_uuid', 'program_uuid', 'index'])
    //   .execute();
  },

  async down(): Promise<void> {
    // await db.schema
    //   .createIndex(
    //     'filler_show_content_filler_show_uuid_program_uuid_index_unique',
    //   )
    //   .ifNotExists()
    //   .on('filler_show_content')
    //   .columns(['filler_show_uuid', 'program_uuid', 'index'])
    //   .unique()
    //   .execute();
    // if (! await columnExists(db, 'filler_show_content', 'index')) {
    //   await db.schema
    //     .alterTable('filler_show_content')
    //     .addColumn('index', 'integer', col => col.notNull())
    //     .execute();
    // }
    // await db.schema
    //   .alterTable('filler_show_content')
    //   .addColumn('index', 'integer', (col) => col.notNull())
    //   .execute();
  },
};
