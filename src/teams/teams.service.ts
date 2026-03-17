import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember, TeamRole } from './team-member.entity';

export interface CreateTeamDto {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly memberRepository: Repository<TeamMember>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    const existing = await this.teamRepository.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Team slug "${dto.slug}" already taken`);
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const team = manager.create(Team, dto);
      const savedTeam = await manager.save(team);

      const membership = manager.create(TeamMember, {
        teamId: savedTeam.id,
        userId: dto.ownerId,
        role: TeamRole.OWNER,
      });
      await manager.save(membership);

      return savedTeam;
    });
  }

  async findById(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return team;
  }

  async addMember(teamId: string, userId: string, role: TeamRole = TeamRole.MEMBER): Promise<TeamMember> {
    const existing = await this.memberRepository.findOne({ where: { teamId, userId } });
    if (existing) {
      throw new ConflictException('User is already a member of this team');
    }
    const member = this.memberRepository.create({ teamId, userId, role });
    return this.memberRepository.save(member);
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    return this.memberRepository.find({
      where: { teamId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    const memberships = await this.memberRepository
      .createQueryBuilder('tm')
      .leftJoinAndSelect('tm.team', 'team')
      .where('tm.userId = :userId', { userId })
      .andWhere('team.isActive = :active', { active: true })
      .orderBy('tm.joinedAt', 'DESC')
      .getMany();

    return memberships.map((m) => m.team);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const result = await this.memberRepository.delete({ teamId, userId });
    if (!result.affected) {
      throw new NotFoundException('Membership not found');
    }
  }
}
