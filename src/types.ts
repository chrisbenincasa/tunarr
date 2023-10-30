export type GlobalOptions = {
  database: string;
  force_migration: boolean;
};

export type ServerOptions = GlobalOptions & {
  port: number;
};

export type Maybe<T> = T | undefined;
