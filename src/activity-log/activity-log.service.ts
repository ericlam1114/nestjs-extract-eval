import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './activity-log.entity';

export interface LogActivityDto {
  userId?: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  description?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityFilters {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: ActivityAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async log(dto: LogActivityDto): Promise<ActivityLog> {
    const entry = this.activityLogRepository.create(dto);
    return this.activityLogRepository.save(entry);
  }

  async findByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findByUser(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async search(filters: ActivityFilters): Promise<{ logs: ActivityLog[]; total: number }> {
    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

    if (filters.userId) {
      qb.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    qb.orderBy('log.createdAt', 'DESC');

    const total = await qb.getCount();

    if (filters.offset) {
      qb.offset(filters.offset);
    }
    qb.limit(filters.limit ?? 50);

    const logs = await qb.getMany();
    return { logs, total };
  }

  async getActionCounts(
    entityType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ action: string; count: number }>> {
    const results = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.entityType = :entityType', { entityType })
      .andWhere('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt <= :endDate', { endDate })
      .groupBy('log.action')
      .getRawMany();

    return results.map((r: { action: string; count: string }) => ({
      action: r.action,
      count: parseInt(r.count, 10),
    }));
  }
}
