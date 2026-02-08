"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationParams = exports.paginated = exports.error = exports.success = void 0;
const success = (data, message) => ({
    success: true,
    data,
    message,
});
exports.success = success;
const error = (message, errors) => ({
    success: false,
    message,
    errors,
});
exports.error = error;
const paginated = (data, total, params) => {
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
exports.paginated = paginated;
const parsePaginationParams = (query) => {
    const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10) || 20));
    const sortBy = typeof query['sortBy'] === 'string' ? query['sortBy'] : undefined;
    const sortOrder = query['sortOrder'] === 'desc' ? 'desc' : 'asc';
    return { page, limit, sortBy, sortOrder };
};
exports.parsePaginationParams = parsePaginationParams;
//# sourceMappingURL=response.js.map