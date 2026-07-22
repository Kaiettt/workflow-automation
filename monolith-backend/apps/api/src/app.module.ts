import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DesignerModule } from '../../../libs/modules/designer/src';
import { PrismaModule } from '../../../libs/shared-infra/src';

@Module({
  imports: [DesignerModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
