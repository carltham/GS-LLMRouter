export interface RouterConfig {
  apiKey: string;
  adminToken: string;
  baseUrl: URL;
  databasePath: string;
  port: number;
  host: string;
  blacklist: string[];
  catalogRefreshHours: number;
}
