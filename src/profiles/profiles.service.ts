import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './profile.entity';

export interface UpdateProfileDto {
  bio?: string;
  location?: string;
  websiteUrl?: string;
  jobTitle?: string;
  company?: string;
  socialLinks?: Record<string, string>;
  preferredLanguage?: string;
  timezone?: string;
  isPublic?: boolean;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async getOrCreate(userId: string): Promise<Profile> {
    let profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepository.create({ userId });
      profile = await this.profileRepository.save(profile);
    }
    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException(`Profile for user ${userId} not found`);
    }
    Object.assign(profile, dto);
    return this.profileRepository.save(profile);
  }

  async findPublicProfiles(limit: number = 20): Promise<Profile[]> {
    return this.profileRepository.find({
      where: { isPublic: true },
      relations: ['user'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async searchByLocation(location: string): Promise<Profile[]> {
    return this.profileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('LOWER(profile.location) LIKE LOWER(:loc)', {
        loc: `%${location}%`,
      })
      .andWhere('profile.isPublic = :pub', { pub: true })
      .getMany();
  }
}
