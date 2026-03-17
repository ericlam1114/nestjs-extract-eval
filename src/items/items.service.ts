import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  async findById(id: string): Promise<Item> {
    const item = await this.itemRepository.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }
    return item;
  }

  async findByOwner(ownerId: string): Promise<Item[]> {
    return this.itemRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(title: string, ownerId: string, description?: string): Promise<Item> {
    const item = this.itemRepository.create({ title, ownerId, description });
    return this.itemRepository.save(item);
  }
}
