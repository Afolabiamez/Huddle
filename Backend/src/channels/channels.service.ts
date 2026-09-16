import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateChannelDto) {
    try {
      const channel = await this.prisma.channel.create({
        data: {
          name: dto.name,
          description: dto.description,
          isPrivate: dto.isPrivate ?? false,
          createdById: userId,
          // Creator automatically becomes the first member so they can
          // immediately open and post in the channel they just made.
          members: {
            create: { userId },
          },
        },
        include: { _count: { select: { members: true } } },
      });
      return this.toChannelDto(channel);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Channel name "${dto.name}" is already taken`,
        );
      }
      throw err;
    }
  }

  /**
   * Lists channels visible to the requesting user: all public channels, plus
   * any private channel they already belong to. Flags which ones they've
   * joined so the client can render "Join" vs "Open".
   */
  async findAllForUser(userId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        OR: [{ isPrivate: false }, { members: { some: { userId } } }],
      },
      include: {
        _count: { select: { members: true } },
        members: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((channel) => ({
      ...this.toChannelDto(channel),
      isMember: channel.members.length > 0,
    }));
  }

  async findOneOrThrow(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { _count: { select: { members: true } } },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }
    return channel;
  }

  async findOneForUser(userId: string, channelId: string) {
    const channel = await this.findOneOrThrow(channelId);
    if (channel.isPrivate) {
      const membership = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this private channel',
        );
      }
    }
    return this.toChannelDto(channel);
  }

  async join(userId: string, channelId: string) {
    const channel = await this.findOneOrThrow(channelId);

    if (channel.isPrivate) {
      throw new ForbiddenException(
        'This channel is private and requires an invite',
      );
    }

    try {
      const membership = await this.prisma.channelMember.create({
        data: { channelId, userId },
      });
      return membership;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Already a member of this channel');
      }
      throw err;
    }
  }

  async listMembers(userId: string, channelId: string) {
    await this.findOneForUser(userId, channelId);
    return this.prisma.channelMember.findMany({
      where: { channelId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Used by MessagesService to enforce that only members of a channel can
   * read or post messages in it.
   */
  async assertMembership(userId: string, channelId: string): Promise<void> {
    const channel = await this.findOneOrThrow(channelId);
    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    if (!membership) {
      if (channel.isPrivate) {
        throw new ForbiddenException(
          'You are not a member of this private channel',
        );
      }
      throw new ForbiddenException(
        'Join the channel before sending or reading messages',
      );
    }
  }

  private toChannelDto(channel: {
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
    createdById: string;
    createdAt: Date;
    _count: { members: number };
  }) {
    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      isPrivate: channel.isPrivate,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      memberCount: channel._count.members,
    };
  }
}
