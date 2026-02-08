import type { ApiResponse, PaginatedResponse, PaginationParams } from '../types/index.js';
export declare const success: <T>(data: T, message?: string) => ApiResponse<T>;
export declare const error: (message: string, errors?: Record<string, string[]>) => ApiResponse;
export declare const paginated: <T>(data: T[], total: number, params: PaginationParams) => PaginatedResponse<T>;
export declare const parsePaginationParams: (query: Record<string, unknown>) => PaginationParams;
//# sourceMappingURL=response.d.ts.map