import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Profile } from '../profiles/profile.entity';
import { UsersRepository } from './repositories/users.repository';

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
  location?: string;
  teamId?: string;
  limit?: number;
  offset?: number;
}

export interface UserWithProfile {
  user: User;
  profile: Profile | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly usersRepository: UsersRepository,
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
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }
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
    return this.usersRepository.search(filters);
  }

  /**
   * Complex query: get users created within a date range, grouped by day.
   */
  async getUsersCreatedBetween(start: Date, end: Date): Promise<User[]> {
    return this.usersRepository.getUsersCreatedBetween(start, end);
  }

  /**
   * Complex query: bulk status update within a transaction.
   */
  async bulkUpdateStatus(userIds: string[], newStatus: string): Promise<number> {
    return this.usersRepository.bulkUpdateStatus(userIds, newStatus);
  }

  /**
   * Complex query: find users with specific preference values using JSONB.
   */
  async findByPreference(key: string, value: unknown): Promise<User[]> {
    return this.usersRepository.findByPreference(key, value);
  }

  /**
   * Complex query: get user statistics (counts by status).
   */
  async getStatusCounts(): Promise<Array<{ status: string; count: number }>> {
    return this.usersRepository.getStatusCounts();
  }

  /**
   * Complex query: soft-delete (set status to 'deleted') with audit trail.
   */
  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.softDelete(id, user);
  }

  /**
   * Complex query: find recently active users (not deleted, updated within N days).
   */
  async findRecentlyActive(days: number): Promise<User[]> {
    return this.usersRepository.findRecentlyActive(days);
  }

  /**
   * Fetch a user together with their profile in a single optimized query.
   * Uses manager.getRepository(Profile) pattern for cross-entity access
   * without injecting the ProfilesService (avoids circular dependency).
   */
  async getUserWithProfile(userId: string): Promise<UserWithProfile> {
    const user = await this.findById(userId);
    const profile = await this.usersRepository.getProfileForUser(userId);

    return { user, profile };
  }

  /**
   * Search users with profile data joined. Uses queryBuilder to join
   * the profiles table directly for efficient single-query retrieval.
   */
  async searchUsersWithProfiles(
    query: string,
    limit: number = 20,
  ): Promise<Array<{ user: User; location: string | null; bio: string | null }>> {
    return this.usersRepository.searchUsersWithProfiles(query, limit);
  }

  /**
   * Create a user and initialize their profile in a single transaction.
   * Uses manager.getRepository pattern for cross-entity writes.
   */
  async createWithProfile(
    dto: CreateUserDto,
    profileData?: { bio?: string; location?: string; jobTitle?: string },
  ): Promise<UserWithProfile> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    return this.usersRepository.createWithProfile(dto, profileData);
  }

  /**
   * Get users who have incomplete profiles (missing bio, location, or job title).
   * Used by onboarding nudge system to send reminder notifications.
   */
  async findUsersWithIncompleteProfiles(): Promise<User[]> {
    return this.usersRepository.findUsersWithIncompleteProfiles();
  }

  /**
   * Get detailed user statistics including profile completion rate.
   * Returns aggregate data for admin dashboards.
   */
  async getDetailedStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    profileCompletionRate: number;
    statusBreakdown: Array<{ status: string; count: number }>;
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { status: 'active' } });

    const profileStats = await this.usersRepository.getProfileCompletionStats();
    const statusBreakdown = await this.getStatusCounts();

    return {
      totalUsers,
      activeUsers,
      profileCompletionRate: profileStats.rate,
      statusBreakdown,
    };
  }
}
