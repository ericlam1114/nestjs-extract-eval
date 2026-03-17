import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ nullable: true })
  bio!: string | null;

  @Column({ nullable: true })
  location!: string | null;

  @Column({ nullable: true, name: 'website_url' })
  websiteUrl!: string | null;

  @Column({ nullable: true, name: 'job_title' })
  jobTitle!: string | null;

  @Column({ nullable: true })
  company!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'social_links' })
  socialLinks!: Record<string, string> | null;

  @Column({ default: 'en', name: 'preferred_language' })
  preferredLanguage!: string;

  @Column({ default: 'UTC' })
  timezone!: string;

  @Column({ default: false, name: 'is_public' })
  isPublic!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
