import { ValidationPipe } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto.js';
import { MessagesService } from './messages.service.js';

describe('Message pagination', () => {
  const prisma = {
    message: { findMany: vi.fn(), findFirst: vi.fn() },
  };
  const channels = { assertMembership: vi.fn() };
  let service: MessagesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new MessagesService(
      prisma as unknown as PrismaService,
      channels as unknown as ChannelsService,
    );
  });

  it('accepts the database CUID cursor and transforms the page limit', async () => {
    const query = { before: 'c1234567890123456789012345', limit: '2' };
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(
      pipe.transform(query, { type: 'query', metatype: GetMessagesQueryDto }),
    ).resolves.toMatchObject({ before: query.before, limit: 2 });
  });

  it('returns a null cursor on an exactly full final page', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'newer' },
      { id: 'older' },
    ]);
    await expect(
      service.findForChannel('user', 'channel', { limit: 2 }),
    ).resolves.toEqual({
      messages: [{ id: 'older' }, { id: 'newer' }],
      nextCursor: null,
    });
  });

  it('uses an extra row to detect another page without returning it', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'newest' },
      { id: 'boundary' },
      { id: 'next-page' },
    ]);
    await expect(
      service.findForChannel('user', 'channel', { limit: 2 }),
    ).resolves.toEqual({
      messages: [{ id: 'boundary' }, { id: 'newest' }],
      nextCursor: 'boundary',
    });
  });

  it('rejects a cursor missing from the requested channel', async () => {
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.message.findMany.mockResolvedValue([]);
    await expect(
      service.findForChannel('user', 'channel', {
        before: 'other-channel-message',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('continues after a cursor belonging to the requested channel', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'cursor' });
    prisma.message.findMany.mockResolvedValue([{ id: 'older' }]);
    await expect(
      service.findForChannel('user', 'channel', { before: 'cursor', limit: 2 }),
    ).resolves.toEqual({ messages: [{ id: 'older' }], nextCursor: null });
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: { id: 'cursor', channelId: 'channel' },
      select: { id: true },
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId: 'channel' },
        cursor: { id: 'cursor' },
        skip: 1,
        take: 3,
      }),
    );
  });

  it('checks membership before querying messages', async () => {
    channels.assertMembership.mockRejectedValue(new Error('Access denied'));
    await expect(service.findForChannel('user', 'channel', {})).rejects.toThrow(
      'Access denied',
    );
    expect(prisma.message.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});
