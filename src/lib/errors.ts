export class AppError extends Error {
    public status: number;
    public code: string;
    public details?: unknown;

    constructor(
        message: string,
        status: number,
        code: string,
        details?: unknown
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const badRequest = (m: string, d?: unknown) => new AppError(m, 400, "BAD_REQUEST", d);
export const unauthorized = (m: string, d?: unknown) => new AppError(m, 401, "UNAUTHORIZED", d);
export const forbidden = (m: string, d?: unknown) => new AppError(m, 403, "FORBIDDEN", d);
export const notFound = (m: string, d?: unknown) => new AppError(m, 404, "NOT_FOUND", d);
export const conflict = (m: string, d?: unknown) => new AppError(m, 409, "CONFLICT", d);
export const tooMany = (m: string, d?: unknown) => new AppError(m, 429, "RATE_LIMIT", d);
