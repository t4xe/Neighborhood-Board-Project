declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }
  export interface Database {
    run(sql: string, params?: (string | number | null)[]): void;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }
  export interface Statement {
    bind(values: (string | number | null)[]): boolean;
    step(): boolean;
    get(): unknown[];
    getColumnNames(): string[];
    free(): boolean;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
