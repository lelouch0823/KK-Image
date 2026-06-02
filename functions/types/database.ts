/**
 * D1 数据库相关类型定义
 * 用于 Cloudflare Workers D1 数据库操作
 */

/** D1 查询结果元数据 */
export interface D1Meta {
  changes: number;
  duration: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
  size_after: number;
}

/** D1 执行结果 */
export interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  meta: D1Meta;
  results: T[];
}

/** D1 单行结果 */
export interface D1FirstResult<T = Record<string, unknown>> {
  success: boolean;
  meta: D1Meta;
  results: T[];
}

/** D1 预编译语句 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

/** D1 数据库接口 */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
}

/** D1 执行结果（用于 exec） */
export interface D1ExecResult {
  count: number;
  duration: number;
}

/** 查询性能监控元数据 */
export interface QueryPerf {
  operation: string;
  label: string;
  duration: number;
  rowsRead: number | null;
  rowsWritten: number | null;
}

/** 带性能监控的查询结果 */
export interface MonitoredResult<T> extends D1Result<T> {
  _perf?: QueryPerf;
}

/** 分页参数 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  results: T[];
  total: number;
  pages: number;
}

/** 分页计算结果 */
export interface ParsedPagination {
  page: number;
  limit: number;
  offset: number;
}

/** 分页选项 */
export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}
