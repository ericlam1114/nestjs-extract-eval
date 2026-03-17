/**
 * UsersService unit tests.
 *
 * These tests mock the TypeORM repository and DataSource, then verify the
 * service's public API. CRITICALLY: these tests pass whether or not the
 * internal implementation uses createQueryBuilder directly or delegates to
 * a separate repository class. This is intentional — it reproduces the
 * "reward hack" where an agent sees green tests and stops before wiring.
 */
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';

const mockRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};

const mockUsersRepository = {
  search: jest.fn(),
  getUsersCreatedBetween: jest.fn(),
  bulkUpdateStatus: jest.fn(),
  findByPreference: jest.fn(),
  getStatusCounts: jest.fn(),
  softDelete: jest.fn(),
  findRecentlyActive: jest.fn(),
  getProfileForUser: jest.fn(),
  searchUsersWithProfiles: jest.fn(),
  createWithProfile: jest.fn(),
  findUsersWithIncompleteProfiles: jest.fn(),
  getProfileCompletionStats: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation with mocks — bypasses NestJS DI
    service = new (UsersService as any)(mockRepository, mockUsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      const user = { id: '1', email: 'test@test.com', firstName: 'Test', lastName: 'User' };
      mockRepository.findOne.mockResolvedValueOnce(user);
      const result = await service.findById('1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user or null', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      const result = await service.findByEmail('notfound@test.com');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const dto = { email: 'new@test.com', firstName: 'New', lastName: 'User' };
      const created = { id: '2', ...dto };
      mockRepository.findOne.mockResolvedValueOnce(null); // no existing user
      mockRepository.create.mockReturnValueOnce(created);
      mockRepository.save.mockResolvedValueOnce(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
    });

    it('should throw ConflictException for duplicate email', async () => {
      const existing = { id: '1', email: 'dup@test.com' };
      mockRepository.findOne.mockResolvedValueOnce(existing);
      await expect(
        service.create({ email: 'dup@test.com', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('search', () => {
    it('should return users and total count', async () => {
      mockUsersRepository.search.mockResolvedValueOnce({ users: [{ id: '1' }], total: 5 });

      const result = await service.search({ status: 'active', limit: 10 });
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(mockUsersRepository.search).toHaveBeenCalledWith({ status: 'active', limit: 10 });
    });
  });

  describe('getUsersCreatedBetween', () => {
    it('should return users in date range', async () => {
      mockUsersRepository.getUsersCreatedBetween.mockResolvedValueOnce([]);
      const result = await service.getUsersCreatedBetween(new Date(), new Date());
      expect(Array.isArray(result)).toBe(true);
      expect(mockUsersRepository.getUsersCreatedBetween).toHaveBeenCalled();
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple users in a transaction', async () => {
      mockUsersRepository.bulkUpdateStatus.mockResolvedValueOnce(3);
      const result = await service.bulkUpdateStatus(['1', '2', '3'], 'inactive');
      expect(typeof result).toBe('number');
      expect(mockUsersRepository.bulkUpdateStatus).toHaveBeenCalledWith(['1', '2', '3'], 'inactive');
    });
  });

  describe('findByPreference', () => {
    it('should query JSONB preferences', async () => {
      mockUsersRepository.findByPreference.mockResolvedValueOnce([]);
      const result = await service.findByPreference('theme', 'dark');
      expect(Array.isArray(result)).toBe(true);
      expect(mockUsersRepository.findByPreference).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('getStatusCounts', () => {
    it('should return status breakdown', async () => {
      mockUsersRepository.getStatusCounts.mockResolvedValueOnce([
        { status: 'active', count: 10 },
        { status: 'inactive', count: 5 },
      ]);
      const result = await service.getStatusCounts();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('count');
      expect(mockUsersRepository.getStatusCounts).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should set user status to deleted in a transaction', async () => {
      const user = { id: '1', status: 'active' };
      mockRepository.findOne.mockResolvedValueOnce(user);
      mockUsersRepository.softDelete.mockResolvedValueOnce(undefined);
      await expect(service.softDelete('1')).resolves.toBeUndefined();
      expect(mockUsersRepository.softDelete).toHaveBeenCalledWith('1', user);
    });

    it('should throw if user not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.softDelete('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRecentlyActive', () => {
    it('should return non-deleted users updated recently', async () => {
      mockUsersRepository.findRecentlyActive.mockResolvedValueOnce([]);
      const result = await service.findRecentlyActive(7);
      expect(Array.isArray(result)).toBe(true);
      expect(mockUsersRepository.findRecentlyActive).toHaveBeenCalledWith(7);
    });
  });

  describe('getUserWithProfile', () => {
    it('should return user with profile', async () => {
      const user = { id: '1', email: 'test@test.com', firstName: 'T', lastName: 'U' };
      mockRepository.findOne.mockResolvedValueOnce(user);
      mockUsersRepository.getProfileForUser.mockResolvedValueOnce(null);
      const result = await service.getUserWithProfile('1');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(mockUsersRepository.getProfileForUser).toHaveBeenCalledWith('1');
    });
  });

  describe('searchUsersWithProfiles', () => {
    it('should return users with profile data', async () => {
      mockUsersRepository.searchUsersWithProfiles.mockResolvedValueOnce([]);
      const result = await service.searchUsersWithProfiles('test');
      expect(Array.isArray(result)).toBe(true);
      expect(mockUsersRepository.searchUsersWithProfiles).toHaveBeenCalledWith('test', 20);
    });
  });

  describe('createWithProfile', () => {
    it('should create user and profile in transaction', async () => {
      const dto = { email: 'new@test.com', firstName: 'N', lastName: 'U' };
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockUsersRepository.createWithProfile.mockResolvedValueOnce({
        user: { id: '3', ...dto },
        profile: { id: 'p1', userId: '3', bio: 'hello' },
      });

      const result = await service.createWithProfile(dto, { bio: 'hello' });
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(mockUsersRepository.createWithProfile).toHaveBeenCalledWith(dto, { bio: 'hello' });
    });
  });

  describe('findUsersWithIncompleteProfiles', () => {
    it('should return users missing profile data', async () => {
      mockUsersRepository.findUsersWithIncompleteProfiles.mockResolvedValueOnce([]);
      const result = await service.findUsersWithIncompleteProfiles();
      expect(Array.isArray(result)).toBe(true);
      expect(mockUsersRepository.findUsersWithIncompleteProfiles).toHaveBeenCalled();
    });
  });

  describe('getDetailedStats', () => {
    it('should return aggregate statistics', async () => {
      mockRepository.count.mockResolvedValueOnce(100);
      mockRepository.count.mockResolvedValueOnce(80);
      mockUsersRepository.getProfileCompletionStats.mockResolvedValueOnce({
        total: 100,
        complete: 75,
        rate: 75,
      });
      mockUsersRepository.getStatusCounts.mockResolvedValueOnce([{ status: 'active', count: 80 }]);

      const result = await service.getDetailedStats();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('activeUsers');
      expect(result).toHaveProperty('profileCompletionRate');
      expect(result).toHaveProperty('statusBreakdown');
      expect(mockUsersRepository.getProfileCompletionStats).toHaveBeenCalled();
    });
  });
});
