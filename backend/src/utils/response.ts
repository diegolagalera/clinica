import type { ApiResponse, PaginatedResponse, PaginationParams } from '../types/index.js';

export const success = <T>(data: T, message?: string): ApiResponse<T> => ({
    success: true,
    data,
    message,
});

export const error = (message: string, errors?: Record<string, string[]>): ApiResponse => ({
    success: false,
    message,
    errors,
});

export const paginated = <T>(
    data: T[],
    total: number,
    params: PaginationParams
): PaginatedResponse<T> => {
    const totalPages = Math.ceil(total / params.limit);
    return {
        data,
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages,
            hasNext: params.page < totalPages,
            hasPrev: params.page > 1,
        },
    };
};

export const parsePaginationParams = (query: Record<string, unknown>): PaginationParams => {
    const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10) || 20));
    const sortBy = typeof query['sortBy'] === 'string' ? query['sortBy'] : undefined;
    const sortOrder = query['sortOrder'] === 'desc' ? 'desc' : 'asc';

    return { page, limit, sortBy, sortOrder };
};
