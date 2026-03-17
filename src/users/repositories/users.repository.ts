import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { User } from '../user.entity';
import { Profile } from '../../profiles/profile.entity';

export interface UserSearchFilters {
  status?: string;
  query?: string;
  location?: string;
  teamId?: string;
  limit?: number;
  offset?: number;
}

export interface UserSearchResult {
  users: User[];
  total: number;
}

export interface UserStatusCount {
  status: string;
  count: number;
}

export interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Complex query: full-text search across name and email with status filter.
   * Uses createQueryBuilder for JOIN and WHERE conditions.
   */
  async search(filters: UserSearchFilters): Promise<UserSearchResult> {
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
  async bulkUpdateStatus(userIds: string[], newStatus: string, manager?: EntityManager): Promise<number> {
    const executeUpdate = async (mgr: EntityManager) => {
      const result = await mgr
        .createQueryBuilder()
        .update(User)
        .set({ status: newStatus })
        .whereInIds(userIds)
        .execute();

      return result.affected ?? 0;
    };

    if (manager) {
      return executeUpdate(manager);
    }

    return this.dataSource.transaction(executeUpdate);
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
  async getStatusCounts(): Promise<UserStatusCount[]> {
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
  async softDelete(id: string, user: User, manager?: EntityManager): Promise<void> {
    const executeSoftDelete = async (mgr: EntityManager) => {
      user.status = 'deleted';
      await mgr.save(user);
    };

    if (manager) {
      return executeSoftDelete(manager);
    }

    return this.dataSource.transaction(executeSoftDelete);
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

  /**
   * Fetch profile for a user using cross-entity access pattern.
   */
  async getProfileForUser(userId: string): Promise<Profile | null> {
    const profileRepo = this.dataSource.getRepository(Profile);
    return profileRepo.findOne({ where: { userId } });
  }

  /**
   * Search users with profile data joined. Uses queryBuilder to join
   * the profiles table directly for efficient single-query retrieval.
   */
  async searchUsersWithProfiles(
    query: string,
    limit: number = 20,
  ): Promise<Array<{ user: User; location: string | null; bio: string | null }>> {
    const results = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('profiles', 'profile', 'profile.user_id = user.id')
      .addSelect('profile.location', 'profile_location')
      .addSelect('profile.bio', 'profile_bio')
      .where(
        '(LOWER(user.firstName) LIKE LOWER(:q) OR LOWER(user.lastName) LIKE LOWER(:q) OR LOWER(user.email) LIKE LOWER(:q))',
        { q: `%${query}%` },
      )
      .andWhere('user.status != :deleted', { deleted: 'deleted' })
      .orderBy('user.createdAt', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.entities.map((user, i) => ({
      user,
      location: results.raw[i]?.profile_location ?? null,
      bio: results.raw[i]?.profile_bio ?? null,
    }));
  }

  /**
   * Create a user and initialize their profile in a single transaction.
   * Uses manager.getRepository pattern for cross-entity writes.
   */
  async createWithProfile(
    dto: { email: string; firstName: string; lastName: string; avatarUrl?: string; preferences?: Record<string, unknown> },
    profileData?: { bio?: string; location?: string; jobTitle?: string },
  ): Promise<UserWithProfile> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const user = manager.create(User, dto);
      const savedUser = await manager.save(user);

      // Cross-module write: create Profile entity via transaction manager
      const profile = manager.create(Profile, {
        userId: savedUser.id,
        ...profileData,
      });
      const savedProfile = await manager.save(profile);

      return { user: savedUser, profile: savedProfile };
    });
  }

  /**
   * Get users who have incomplete profiles (missing bio, location, or job title).
   * Used by onboarding nudge system to send reminder notifications.
   */
  async findUsersWithIncompleteProfiles(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoin('profiles', 'profile', 'profile.user_id = user.id')
      .where('user.status = :active', { active: 'active' })
      .andWhere(
        '(profile.id IS NULL OR profile.bio IS NULL OR profile.location IS NULL OR profile.job_title IS NULL)',
      )
      .orderBy('user.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Get profile completion statistics.
   */
  async getProfileCompletionStats(): Promise<{ total: number; complete: number; rate: number }> {
    const profileRepo = this.dataSource.getRepository(Profile);
    const totalProfiles = await profileRepo.count();
    const completeProfiles = await profileRepo
      .createQueryBuilder('profile')
      .where('profile.bio IS NOT NULL')
      .andWhere('profile.location IS NOT NULL')
      .andWhere('profile.job_title IS NOT NULL')
      .getCount();

    const rate = totalProfiles > 0 ? (completeProfiles / totalProfiles) * 100 : 0;

    return { total: totalProfiles, complete: completeProfiles, rate };
  }
}
