import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum NotificationType {
  SYSTEM = 'system',
  MENTION = 'mention',
  PAYMENT = 'payment',
  TEAM_INVITE = 'team_invite',
  ITEM_UPDATE = 'item_update',
}

@Entity('notifications')
@Index(['recipientId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  recipient!: User;

  @Column({ name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type!: NotificationType;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ nullable: true, name: 'action_url' })
  actionUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
