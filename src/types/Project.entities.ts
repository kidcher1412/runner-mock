export interface Project {
  name: string;
  file: string; // file OpenAPI
  useDB?: boolean; // nếu true thì endpoint sẽ query SQLite
  dbFile?: string; // đường dẫn SQLite file riêng của project
}
