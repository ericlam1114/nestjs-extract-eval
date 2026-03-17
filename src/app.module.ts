import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';

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
  ],
})
export class AppModule {}
