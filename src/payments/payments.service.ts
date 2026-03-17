import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from './payment.entity';

export interface CreatePaymentDto {
  userId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  description?: string;
}

export interface PaymentSummary {
  totalAmount: number;
  count: number;
  currency: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }
    const payment = this.paymentRepository.create({
      ...dto,
      currency: dto.currency ?? 'USD',
      status: PaymentStatus.PENDING,
    });
    return this.paymentRepository.save(payment);
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    return payment;
  }

  async findByUser(userId: string, status?: PaymentStatus): Promise<Payment[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .orderBy('payment.createdAt', 'DESC');

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    return qb.getMany();
  }

  async processPayment(paymentId: string): Promise<Payment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const payment = await manager.findOne(Payment, { where: { id: paymentId } });
      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(`Cannot process payment in ${payment.status} status`);
      }
      payment.status = PaymentStatus.PROCESSING;
      return manager.save(payment);
    });
  }

  async completePayment(paymentId: string, externalId: string): Promise<Payment> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const payment = await manager.findOne(Payment, { where: { id: paymentId } });
      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }
      payment.status = PaymentStatus.COMPLETED;
      payment.externalId = externalId;
      payment.completedAt = new Date();
      return manager.save(payment);
    });
  }

  async getUserPaymentSummary(userId: string): Promise<PaymentSummary[]> {
    const results = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.currency', 'currency')
      .addSelect('SUM(payment.amount)', 'totalAmount')
      .addSelect('COUNT(*)', 'count')
      .where('payment.userId = :userId', { userId })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .groupBy('payment.currency')
      .getRawMany();

    return results.map((r: { currency: string; totalAmount: string; count: string }) => ({
      currency: r.currency,
      totalAmount: parseFloat(r.totalAmount),
      count: parseInt(r.count, 10),
    }));
  }
}
