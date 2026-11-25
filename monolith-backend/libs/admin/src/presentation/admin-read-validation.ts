import { BadRequestException } from '@nestjs/common';

const DAY_MS = 86_400_000;
const MAX_QUERY_OFFSET = 2_147_483_647;
export function adminListRange(query: {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}) {
  const offset = (query.page - 1) * query.pageSize;
  if (!Number.isSafeInteger(offset) || offset > MAX_QUERY_OFFSET)
    throw new BadRequestException('Requested page is too large');
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 7 * DAY_MS);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > 90 * DAY_MS
  )
    throw new BadRequestException('Select a valid range of up to 90 days');
  return { from, to };
}
