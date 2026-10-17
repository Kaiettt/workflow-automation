import { NodeCategory as PrismaNodeCategory } from '@prisma/client';
import type { NodeTypeDefinition as PrismaNodeTypeDefinition } from '@prisma/client';
import { NodeCategory } from '../../../domain/enums/node-category.enum';
import { NodeTypeDefinitionMapper } from './node-type-definition.mapper';

const row = (category: PrismaNodeCategory): PrismaNodeTypeDefinition => ({
  id: 'id-1',
  key: 'some.node',
  displayName: 'Some node',
  icon: null,
  color: null,
  category,
  description: null,
  configSchema: {},
  inputSchema: null,
  outputSchema: null,
  connectorId: null,
  isActive: true,
  createdAt: new Date('2026-10-17T00:00:00Z'),
  updatedAt: new Date('2026-10-17T00:00:00Z'),
});

describe('NodeTypeDefinitionMapper', () => {
  // Guards against a category added to the database but forgotten here,
  // which used to be filed silently under LOGIC.
  it.each(Object.values(PrismaNodeCategory))(
    'keeps the category %s',
    (category) => {
      expect(NodeTypeDefinitionMapper.toDomain(row(category)).category).toBe(
        category,
      );
    },
  );

  it('has a domain value for every database category', () => {
    expect(Object.values(NodeCategory).sort()).toEqual(
      Object.values(PrismaNodeCategory).sort(),
    );
  });

  it('maps the AI category', () => {
    expect(
      NodeTypeDefinitionMapper.toDomain(row(PrismaNodeCategory.AI)).category,
    ).toBe(NodeCategory.AI);
  });

  it('refuses an unknown category instead of guessing one', () => {
    expect(() =>
      NodeTypeDefinitionMapper.toDomain(
        row('SOMETHING_NEW' as unknown as PrismaNodeCategory),
      ),
    ).toThrow('Unknown node category: SOMETHING_NEW');
  });
});
