import { Test } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdminController } from '@app/admin/presentation/admin.controller';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { NodeTypePolicyError } from '@app/node-library';
import { AdminMutationFieldsGuard } from '@app/admin/presentation/admin-mutation-fields.guard';

describe('Admin node type HTTP (BDD-NM-09)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminMutationFieldsGuard,
        {
          provide: QueryBus,
          useValue: {
            execute: () =>
              Promise.resolve({
                items: [],
                total: 0,
                page: 1,
                pageSize: 20,
              }),
          },
        },
        {
          provide: CommandBus,
          useValue: {
            execute: (command: { params: { expectedRevision: number } }) => {
              if (command.params.expectedRevision === 9)
                throw new NodeTypePolicyError(
                  'STALE_REVISION',
                  'Reload policy',
                );
              return Promise.resolve({
                isCatalogVisible: false,
                isExecutionAllowed: false,
                revision: 1,
              });
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: { id: string; role: string };
          }>();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = {
            id: 'actor',
            role:
              req.headers.authorization === 'Bearer admin' ? 'ADMIN' : 'CLIENT',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  const valid = {
    isCatalogVisible: false,
    isExecutionAllowed: false,
    reason: 'Maintenance window',
    expectedRevision: 0,
  };
  const server = (): Server => app.getHttpServer() as Server;
  it.each([
    { isCatalogVisible: null },
    { isExecutionAllowed: 'false' },
    { expectedRevision: -1 },
    { reason: '   ' },
    { injected: true },
  ])('rejects invalid mutations before dispatch (%j)', async (invalid) => {
    await request(server())
      .patch('/api/admin/node-types/logic.if/status')
      .set('Authorization', 'Bearer admin')
      .send({ ...valid, ...invalid })
      .expect(400);
  });
  it('accepts both flags and maps stale revision to 409', async () => {
    await request(server())
      .patch('/api/admin/node-types/logic.if/status')
      .set('Authorization', 'Bearer admin')
      .send(valid)
      .expect(200);
    const stale = await request(server())
      .patch('/api/admin/node-types/logic.if/status')
      .set('Authorization', 'Bearer admin')
      .send({ ...valid, expectedRevision: 9 })
      .expect(409);
    expect((stale.body as { code: string }).code).toBe('STALE_REVISION');
  });
  it('rejects flagless bodies and invalid paging/categories', async () => {
    await request(server())
      .patch('/api/admin/node-types/logic.if/status')
      .set('Authorization', 'Bearer admin')
      .send({ reason: valid.reason, expectedRevision: 0 })
      .expect(400);
    await request(server())
      .get('/api/admin/node-types?pageSize=101')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    await request(server())
      .get('/api/admin/node-types?category=ACTION')
      .set('Authorization', 'Bearer admin')
      .expect(400);
  });
  it('exposes the Admin catalog only to Admin identities', async () => {
    await request(server())
      .get('/api/admin/node-types')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    await request(server())
      .get('/api/admin/node-types')
      .set('Authorization', 'Bearer client')
      .expect(403);
    await request(server()).get('/api/admin/node-types').expect(401);
  });
});
