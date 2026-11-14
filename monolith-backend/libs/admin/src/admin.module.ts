import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@app/auth';
import { PrismaModule } from '@app/database';
import { AdminReadPort } from './application/admin-read.port';
import { AdminReadHandler } from './application/admin-read.query';
import { PrismaAdminRead } from './infrastructure/prisma-admin-read';
import { AdminController } from './presentation/admin.controller';
import { AdminMutationFieldsGuard } from './presentation/admin-mutation-fields.guard';

@Module({
  imports: [CqrsModule, AuthModule, PrismaModule],
  controllers: [AdminController],
  providers: [
    AdminMutationFieldsGuard,
    AdminReadHandler,
    { provide: AdminReadPort, useClass: PrismaAdminRead },
  ],
})
export class AdminModule {}
