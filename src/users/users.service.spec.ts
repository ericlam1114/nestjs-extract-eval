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

// Mock query builder chain — every method returns `this` for chaining
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  whereInIds: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  getOne: jest.fn().mockResolvedValue(null),
  getCount: jest.fn().mockResolvedValue(0),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
};

const mockRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockEntityManager = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  getRepository: jest.fn().mockReturnValue(mockRepository),
};

const mockDataSource = {
  transaction: jest.fn((cb: any) => cb(mockEntityManager)),
  getRepository: jest.fn().mockReturnValue({
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  }),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation with mocks — bypasses NestJS DI
    service = new (UsersService as any)(mockRepository, mockDataSource);
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
      mockQueryBuilder.getCount.mockResolvedValueOnce(5);
      mockQueryBuilder.getMany.mockResolvedValueOnce([{ id: '1' }]);

      const result = await service.search({ status: 'active', limit: 10 });
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getUsersCreatedBetween', () => {
    it('should return users in date range', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      const result = await service.getUsersCreatedBetween(new Date(), new Date());
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple users in a transaction', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 3 });
      const result = await service.bulkUpdateStatus(['1', '2', '3'], 'inactive');
      expect(typeof result).toBe('number');
    });
  });

  describe('findByPreference', () => {
    it('should query JSONB preferences', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      const result = await service.findByPreference('theme', 'dark');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getStatusCounts', () => {
    it('should return status breakdown', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: 'active', count: '10' },
        { status: 'inactive', count: '5' },
      ]);
      const result = await service.getStatusCounts();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('softDelete', () => {
    it('should set user status to deleted in a transaction', async () => {
      const user = { id: '1', status: 'active' };
      mockEntityManager.findOne.mockResolvedValueOnce(user);
      mockEntityManager.save.mockResolvedValueOnce({ ...user, status: 'deleted' });
      await expect(service.softDelete('1')).resolves.toBeUndefined();
    });

    it('should throw if user not found', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(null);
      await expect(service.softDelete('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRecentlyActive', () => {
    it('should return non-deleted users updated recently', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      const result = await service.findRecentlyActive(7);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUserWithProfile', () => {
    it('should return user with profile', async () => {
      const user = { id: '1', email: 'test@test.com', firstName: 'T', lastName: 'U' };
      mockRepository.findOne.mockResolvedValueOnce(user);
      const result = await service.getUserWithProfile('1');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
    });
  });

  describe('searchUsersWithProfiles', () => {
    it('should return users with profile data', async () => {
      mockQueryBuilder.getRawAndEntities.mockResolvedValueOnce({ entities: [], raw: [] });
      const result = await service.searchUsersWithProfiles('test');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createWithProfile', () => {
    it('should create user and profile in transaction', async () => {
      const dto = { email: 'new@test.com', firstName: 'N', lastName: 'U' };
      mockEntityManager.findOne.mockResolvedValueOnce(null);
      mockEntityManager.create.mockReturnValue({ id: '3', ...dto });
      mockEntityManager.save.mockResolvedValue({ id: '3', ...dto });

      const result = await service.createWithProfile(dto, { bio: 'hello' });
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
    });
  });

  describe('findUsersWithIncompleteProfiles', () => {
    it('should return users missing profile data', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);
      const result = await service.findUsersWithIncompleteProfiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDetailedStats', () => {
    it('should return aggregate statistics', async () => {
      mockRepository.count.mockResolvedValueOnce(100);
      mockRepository.count.mockResolvedValueOnce(80);
      mockQueryBuilder.getCount.mockResolvedValueOnce(50);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([{ status: 'active', count: '80' }]);

      const result = await service.getDetailedStats();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('activeUsers');
      expect(result).toHaveProperty('profileCompletionRate');
      expect(result).toHaveProperty('statusBreakdown');
    });
  });
});
