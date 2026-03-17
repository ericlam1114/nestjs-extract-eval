import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

export interface CreateNotificationDto {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(dto);
    return this.notificationRepository.save(notification);
  }

  async findByRecipient(
    recipientId: string,
    unreadOnly: boolean = false,
    limit: number = 50,
  ): Promise<Notification[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipientId = :recipientId', { recipientId })
      .orderBy('n.createdAt', 'DESC')
      .take(limit);

    if (unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    return qb.getMany();
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      readAt: new Date(),
    });
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('recipient_id = :recipientId', { recipientId })
      .andWhere('read_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.notificationRepository
      .createQueryBuilder('n')
      .where('n.recipientId = :recipientId', { recipientId })
      .andWhere('n.readAt IS NULL')
      .getCount();
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('created_at < :cutoff', { cutoff })
      .andWhere('read_at IS NOT NULL')
      .execute();
    return result.affected ?? 0;
  }
}
