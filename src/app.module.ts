import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { ProfilesModule } from './profiles/profiles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { TeamsModule } from './teams/teams.module';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'eval_test',
      autoLoadEntities: true,
      synchronize: false,
    }),
    UsersModule,
    ItemsModule,
    ProfilesModule,
    NotificationsModule,
    PaymentsModule,
    TeamsModule,
    ActivityLogModule,
  ],
})
export class AppModule {}
