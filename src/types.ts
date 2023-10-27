export type GlobalOptions = {
  database: string;
  force_migration: boolean;
};

export type ServerOptions = GlobalOptions & {
  port: number;
};
