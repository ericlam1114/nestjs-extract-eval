import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from './pagination.dto';

/**
 * Utility functions for building TypeORM queries consistently.
 * Used across multiple services to reduce query boilerplate.
 */

export function applyPagination<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  pagination: PaginationDto,
): SelectQueryBuilder<T> {
  return qb.skip(pagination.offset).take(pagination.limit);
}

export function applyDateRange<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  column: string,
  startDate?: Date,
  endDate?: Date,
): SelectQueryBuilder<T> {
  if (startDate) {
    qb.andWhere(`${alias}.${column} >= :startDate`, { startDate });
  }
  if (endDate) {
    qb.andWhere(`${alias}.${column} <= :endDate`, { endDate });
  }
  return qb;
}

export function applySearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  columns: string[],
  searchTerm?: string,
): SelectQueryBuilder<T> {
  if (!searchTerm) return qb;

  const conditions = columns
    .map((col) => `LOWER(${alias}.${col}) LIKE LOWER(:search)`)
    .join(' OR ');

  return qb.andWhere(`(${conditions})`, { search: `%${searchTerm}%` });
}

export function applySorting<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  pagination: PaginationDto,
  allowedColumns: string[],
): SelectQueryBuilder<T> {
  const column = allowedColumns.includes(pagination.sortBy)
    ? pagination.sortBy
    : 'createdAt';
  return qb.orderBy(`${alias}.${column}`, pagination.sortOrder);
}
