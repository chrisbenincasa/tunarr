/**
 * Thrown when the database records migrations this build does not know about,
 * which means it was written by a newer Tunarr. Running against it would read a
 * schema this build cannot understand, so startup stops here instead.
 */
export class DatabaseSchemaTooNewError extends Error {
  constructor(
    readonly databasePath: string,
    readonly unknownMigrations: string[],
  ) {
    super(
      `The database at ${databasePath} was created by a newer version of Tunarr and cannot be used by this one. ` +
        `It has ${unknownMigrations.length} migration(s) this version does not know about, starting with "${unknownMigrations[0]}". ` +
        `Either run the newer version of Tunarr again, or restore the snapshot taken before that upgrade — ` +
        `look for a file named *-pre-migration-*.bak next to the database and copy it over ${databasePath}.`,
    );
    this.name = DatabaseSchemaTooNewError.name;
  }
}
