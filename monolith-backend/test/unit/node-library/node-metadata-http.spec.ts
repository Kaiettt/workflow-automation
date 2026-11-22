import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { NodeTypesController } from '@app/node-library/presentation/http/node-types.controller';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { NodeTypeDefinition } from '@app/node-library/domain/entities/node-type-definition.entity';
import { NodeCategory } from '@app/node-library/domain/enums/node-category.enum';

describe('Existing-node metadata HTTP (BDD-NM-02)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NodeTypesController],
      providers: [
        {
          provide: QueryBus,
          useValue: {
            execute: () =>
              Promise.resolve([
                new NodeTypeDefinition(
                  'node',
                  'logic.switch',
                  'Switch',
                  NodeCategory.LOGIC,
                  { properties: { rules: { type: 'array' } } },
                  true,
                ),
              ]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([
    '',
    'logic.if,logic.if',
    Array.from({ length: 101 }, (_, i) => 'logic.' + i).join(','),
    'x'.repeat(151),
  ])('rejects invalid metadata key sets', async (keys) => {
    await request(app.getHttpServer() as Server)
      .get('/api/node-types/metadata')
      .query({ keys })
      .expect(400);
  });
  it('returns metadata requested for an existing node', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/node-types/metadata?keys=logic.switch')
      .expect(200);
    expect(
      (response.body as { data: { key: string; configSchema: unknown }[] })
        .data[0],
    ).toMatchObject({
      key: 'logic.switch',
      configSchema: { properties: { rules: { type: 'array' } } },
    });
  });
});
