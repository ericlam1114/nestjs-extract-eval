import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { User } from './user.entity';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  preferences?: Record<string, unknown>;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  preferences?: Record<string, unknown>;
  status?: string;
}

export interface UserSearchFilters {
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  /**
   * Complex query: full-text search across name and email with status filter.
   * Uses createQueryBuilder for JOIN and WHERE conditions.
   */
  async search(filters: UserSearchFilters): Promise<{ users: User[]; total: number }> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .select();

    if (filters.status) {
      qb.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters.query) {
      qb.andWhere(
        '(LOWER(user.firstName) LIKE LOWER(:q) OR LOWER(user.lastName) LIKE LOWER(:q) OR LOWER(user.email) LIKE LOWER(:q))',
        { q: `%${filters.query}%` },
      );
    }

    qb.orderBy('user.createdAt', 'DESC');

    const total = await qb.getCount();

    if (filters.offset) {
      qb.offset(filters.offset);
    }
    if (filters.limit) {
      qb.limit(filters.limit);
    }

    const users = await qb.getMany();
    return { users, total };
  }

  /**
   * Complex query: get users created within a date range, grouped by day.
   */
  async getUsersCreatedBetween(start: Date, end: Date): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt >= :start', { start })
      .andWhere('user.createdAt <= :end', { end })
      .orderBy('user.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Complex query: bulk status update within a transaction.
   */
  async bulkUpdateStatus(userIds: string[], newStatus: string): Promise<number> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const result = await manager
        .createQueryBuilder()
        .update(User)
        .set({ status: newStatus })
        .whereInIds(userIds)
        .execute();

      return result.affected ?? 0;
    });
  }

  /**
   * Complex query: find users with specific preference values using JSONB.
   */
  async findByPreference(key: string, value: unknown): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where(`user.preferences->>:key = :value`, { key, value: String(value) })
      .getMany();
  }

  /**
   * Complex query: get user statistics (counts by status).
   */
  async getStatusCounts(): Promise<Array<{ status: string; count: number }>> {
    const results = await this.userRepository
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.status')
      .getRawMany();

    return results.map((r: { status: string; count: string }) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    }));
  }

  /**
   * Complex query: soft-delete (set status to 'deleted') with audit trail.
   */
  async softDelete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(`User ${id} not found`);
      }
      user.status = 'deleted';
      await manager.save(user);
    });
  }

  /**
   * Complex query: find recently active users (not deleted, updated within N days).
   */
  async findRecentlyActive(days: number): Promise<User[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.userRepository
      .createQueryBuilder('user')
      .where('user.status != :deleted', { deleted: 'deleted' })
      .andWhere('user.updatedAt >= :since', { since })
      .orderBy('user.updatedAt', 'DESC')
      .getMany();
  }
}
