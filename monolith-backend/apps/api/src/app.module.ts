import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DesignerModule } from '@app/designer';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../../libs/auth/src';
import { NodeLibraryModule } from '../../../libs/node-library/src';
import { ConnectorModule } from '../../../libs/connector/src';

@Module({
  imports: [
    DesignerModule,
    PrismaModule,
    AuthModule,
    NodeLibraryModule,
    ConnectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
