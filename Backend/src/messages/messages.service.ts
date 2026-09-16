import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channelsService: ChannelsService,
  ) {}

  async send(userId: string, channelId: string, dto: CreateMessageDto) {
    // Only members may post - reuses the same rule that gates reading.
    await this.channelsService.assertMembership(userId, channelId);

    return this.prisma.message.create({
      data: {
        channelId,
        senderId: userId,
        content: dto.content,
      },
      include: { sender: { select: { id: true, email: true } } },
    });
  }

  /**
   * Cursor-paginated read, newest page first. Returns messages in
   * chronological (ascending) order within the page so the client can
   * render top-to-bottom without re-sorting, plus a `nextCursor` to fetch
   * the next older page.
   */
  async findForChannel(
    userId: string,
    channelId: string,
    query: GetMessagesQueryDto,
  ) {
    await this.channelsService.assertMembership(userId, channelId);

    const limit = query.limit ?? 50;

    if (query.before) {
      const cursor = await this.prisma.message.findFirst({
        where: { id: query.before, channelId },
        select: { id: true },
      });
      if (!cursor) {
        throw new BadRequestException(
          'Message cursor is invalid for this channel.',
        );
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.before && {
        cursor: { id: query.before },
        skip: 1, // don't include the cursor message itself
      }),
      include: { sender: { select: { id: true, email: true } } },
    });

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return {
      messages: page.reverse(), // oldest -> newest for display
      nextCursor,
    };
  }
}
