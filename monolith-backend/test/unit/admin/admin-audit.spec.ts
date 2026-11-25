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
import { AdminMutationFieldsGuard } from '@app/admin/presentation/admin-mutation-fields.guard';
import { AdminReadQuery } from '@app/admin/application/admin-read.query';
type TestRequest = {
  headers: Record<string, string>;
  user?: { id: string; role: string };
};

describe('BDD-AL-03: Admin audit HTTP validation', () => {
  let app: INestApplication;
  const dispatch = jest.fn((query: AdminReadQuery) => {
    if (query.request.kind !== 'auditEvents') return Promise.resolve(null);
    return Promise.resolve({
      items: [],
      total: 0,
      page: query.request.filter.page,
      pageSize: query.request.filter.pageSize,
    });
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminMutationFieldsGuard,
        { provide: QueryBus, useValue: { execute: dispatch } },
        { provide: CommandBus, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<TestRequest>();
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
  beforeEach(() => dispatch.mockClear());
  const server = (): Server => app.getHttpServer() as Server;
  it('uses default pagination and a seven-day range, accepts timezone offsets and max 90 days', async () => {
    await request(server())
      .get('/api/admin/audit-events')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    const sent = dispatch.mock.calls[0]?.[0];
    if (sent?.request.kind !== 'auditEvents')
      throw new Error('Audit query not dispatched');
    expect(sent.request.filter).toMatchObject({ page: 1, pageSize: 20 });
    expect(
      sent.request.filter.to.getTime() - sent.request.filter.from.getTime(),
    ).toBe(604800000);
    await request(server())
      .get('/api/admin/audit-events')
      .set('Authorization', 'Bearer admin')
      .query({
        from: '2026-01-01T07:00:00+07:00',
        to: '2026-04-01T07:00:00+07:00',
        pageSize: 100,
      })
      .expect(200);
  });
  it.each([
    { page: '0' },
    { page: '1.5' },
    { page: '1e100' },
    { pageSize: '101' },
    { actorId: 'admin@example.com' },
    { targetId: 'integration.slack.postMessage' },
    { actorType: 'CLIENT' },
    { targetType: 'WORKFLOW' },
    { action: 'CUSTOM' },
    { injected: 'yes' },
    { from: 'not-a-date' },
    { from: '2026-11-01T00:00:00' },
    { from: '2026-11-02T00:00:00Z', to: '2026-11-01T00:00:00Z' },
    { from: '2026-11-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
    { from: '2026-01-01T00:00:00Z', to: '2026-04-02T00:00:00Z' },
  ])('rejects invalid input before query (%j)', async (invalid) => {
    await request(server())
      .get('/api/admin/audit-events')
      .set('Authorization', 'Bearer admin')
      .query(invalid)
      .expect(400);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('rejects malformed detail UUID and returns 404 for missing detail', async () => {
    await request(server())
      .get('/api/admin/audit-events/not-a-uuid')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    expect(dispatch).not.toHaveBeenCalled();
    await request(server())
      .get('/api/admin/audit-events/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer admin')
      .expect(404);
  });
});
