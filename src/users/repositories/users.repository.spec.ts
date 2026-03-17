import { UsersRepository } from './users.repository';
import { User } from '../user.entity';

// Mock query builder chain — every method returns `this` for chaining
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  whereInIds: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  getCount: jest.fn().mockResolvedValue(0),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
};

const mockRepository = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  findOne: jest.fn(),
  count: jest.fn(),
};

const mockEntityManager = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  create: jest.fn(),
  save: jest.fn(),
};

const mockProfileRepository = {
  findOne: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

const mockDataSource = {
  transaction: jest.fn((cb: any) => cb(mockEntityManager)),
  getRepository: jest.fn().mockReturnValue(mockProfileRepository),
};

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation with mocks
    repository = new (UsersRepository as any)(mockRepository, mockDataSource);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('search', () => {
    it('should return users and total count with filters', async () => {
      mockQueryBuilder.getCount.mockResolvedValueOnce(10);
      mockQueryBuilder.getMany.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);

      const result = await repository.search({ status: 'active', query: 'test', limit: 10, offset: 0 });

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(result.total).toBe(10);
      expect(result.users).toHaveLength(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.status = :status', { status: 'active' });
    });

    it('should handle search without filters', async () => {
      mockQueryBuilder.getCount.mockResolvedValueOnce(5);
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);

      const result = await repository.search({});

      expect(result.users).toEqual([]);
      expect(result.total).toBe(5);
    });
  });

  describe('getUsersCreatedBetween', () => {
    it('should return users within date range', async () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-12-31');
      const users = [{ id: '1' }, { id: '2' }];
      mockQueryBuilder.getMany.mockResolvedValueOnce(users);

      const result = await repository.getUsersCreatedBetween(start, end);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(users);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.createdAt >= :start', { start });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.createdAt <= :end', { end });
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update status for multiple users in a transaction', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 3 });

      const result = await repository.bulkUpdateStatus(['1', '2', '3'], 'inactive');

      expect(result).toBe(3);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ status: 'inactive' });
      expect(mockQueryBuilder.whereInIds).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('should use provided manager if available', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 2 });

      const result = await repository.bulkUpdateStatus(['1', '2'], 'deleted', mockEntityManager as any);

      expect(result).toBe(2);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findByPreference', () => {
    it('should query users by JSONB preference', async () => {
      const users = [{ id: '1', preferences: { theme: 'dark' } }];
      mockQueryBuilder.getMany.mockResolvedValueOnce(users);

      const result = await repository.findByPreference('theme', 'dark');

      expect(result).toEqual(users);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        `user.preferences->>:key = :value`,
        { key: 'theme', value: 'dark' },
      );
    });
  });

  describe('getStatusCounts', () => {
    it('should return status breakdown with counts', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { status: 'active', count: '15' },
        { status: 'inactive', count: '8' },
        { status: 'deleted', count: '2' },
      ]);

      const result = await repository.getStatusCounts();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ status: 'active', count: 15 });
      expect(result[1]).toEqual({ status: 'inactive', count: 8 });
      expect(result[2]).toEqual({ status: 'deleted', count: 2 });
    });
  });

  describe('softDelete', () => {
    it('should set user status to deleted in transaction', async () => {
      const user = { id: '1', status: 'active' } as User;
      mockEntityManager.save.mockResolvedValueOnce({ ...user, status: 'deleted' });

      await repository.softDelete('1', user);

      expect(user.status).toBe('deleted');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(user);
    });

    it('should use provided manager if available', async () => {
      const user = { id: '2', status: 'active' } as User;
      mockEntityManager.save.mockResolvedValueOnce({ ...user, status: 'deleted' });

      await repository.softDelete('2', user, mockEntityManager as any);

      expect(user.status).toBe('deleted');
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findRecentlyActive', () => {
    it('should return users updated within specified days', async () => {
      const users = [{ id: '1' }, { id: '2' }];
      mockQueryBuilder.getMany.mockResolvedValueOnce(users);

      const result = await repository.findRecentlyActive(7);

      expect(result).toEqual(users);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.status != :deleted', { deleted: 'deleted' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.updatedAt >= :since',
        expect.objectContaining({ since: expect.any(Date) }),
      );
    });
  });

  describe('getProfileForUser', () => {
    it('should fetch profile for user via DataSource', async () => {
      const profile = { id: 'p1', userId: 'u1', bio: 'Hello' };
      mockProfileRepository.findOne.mockResolvedValueOnce(profile);

      const result = await repository.getProfileForUser('u1');

      expect(result).toEqual(profile);
      expect(mockDataSource.getRepository).toHaveBeenCalled();
      expect(mockProfileRepository.findOne).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });
  });

  describe('searchUsersWithProfiles', () => {
    it('should return users with profile data joined', async () => {
      const entities = [{ id: '1' } as User, { id: '2' } as User];
      const raw = [
        { profile_location: 'NYC', profile_bio: 'Developer' },
        { profile_location: 'SF', profile_bio: 'Designer' },
      ];
      mockQueryBuilder.getRawAndEntities.mockResolvedValueOnce({ entities, raw });

      const result = await repository.searchUsersWithProfiles('test', 10);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('user');
      expect(result[0]).toHaveProperty('location', 'NYC');
      expect(result[0]).toHaveProperty('bio', 'Developer');
    });
  });

  describe('createWithProfile', () => {
    it('should create user and profile in a transaction', async () => {
      const dto = { email: 'new@test.com', firstName: 'New', lastName: 'User' };
      const user = { id: '3', ...dto };
      const profile = { id: 'p3', userId: '3', bio: 'Hello' };

      mockEntityManager.create.mockReturnValueOnce(user).mockReturnValueOnce(profile);
      mockEntityManager.save.mockResolvedValueOnce(user).mockResolvedValueOnce(profile);

      const result = await repository.createWithProfile(dto, { bio: 'Hello' });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findUsersWithIncompleteProfiles', () => {
    it('should return active users with incomplete profile data', async () => {
      const users = [{ id: '1' }, { id: '2' }];
      mockQueryBuilder.getMany.mockResolvedValueOnce(users);

      const result = await repository.findUsersWithIncompleteProfiles();

      expect(result).toEqual(users);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.status = :active', { active: 'active' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(profile.id IS NULL OR profile.bio IS NULL OR profile.location IS NULL OR profile.job_title IS NULL)',
      );
    });
  });

  describe('getProfileCompletionStats', () => {
    it('should return profile completion statistics', async () => {
      mockProfileRepository.count.mockResolvedValueOnce(100);
      mockQueryBuilder.getCount.mockResolvedValueOnce(75);

      const result = await repository.getProfileCompletionStats();

      expect(result).toHaveProperty('total', 100);
      expect(result).toHaveProperty('complete', 75);
      expect(result).toHaveProperty('rate', 75);
    });

    it('should handle zero profiles', async () => {
      mockProfileRepository.count.mockResolvedValueOnce(0);
      mockQueryBuilder.getCount.mockResolvedValueOnce(0);

      const result = await repository.getProfileCompletionStats();

      expect(result.rate).toBe(0);
    });
  });
});
