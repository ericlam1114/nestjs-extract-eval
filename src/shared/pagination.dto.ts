/**
 * Standard pagination parameters used across all list endpoints.
 */
export class PaginationDto {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';

  constructor(partial?: Partial<PaginationDto>) {
    this.page = partial?.page ?? 1;
    this.limit = Math.min(partial?.limit ?? 20, 100);
    this.sortBy = partial?.sortBy ?? 'createdAt';
    this.sortOrder = partial?.sortOrder ?? 'DESC';
  }

  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}

/**
 * Standard paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}
