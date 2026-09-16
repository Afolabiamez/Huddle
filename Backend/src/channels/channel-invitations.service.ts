import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChannelsService } from './channels.service.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ChannelInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
  ) {}

  private async requireOwner(userId: string, channelId: string) {
    const channel = await this.channels.findOneOrThrow(channelId);
    if (channel.createdById !== userId) {
      throw new ForbiddenException(
        'Only the channel creator can manage invitations.',
      );
    }
    if (!channel.isPrivate) {
      throw new BadRequestException(
        'Public channels can be joined without an invitation.',
      );
    }
  }

  async invite(userId: string, channelId: string, inviteeId: string) {
    await this.requireOwner(userId, channelId);
    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeId },
      select: { id: true },
    });
    if (!invitee)
      throw new NotFoundException('Invitation recipient not found.');
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: inviteeId } },
    });
    if (member)
      throw new ConflictException('This user is already a channel member.');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Keep the renewal's row lock until its response has been read, so a
        // concurrent revocation cannot cause a missing-row server error.
        const renewed = await tx.channelInvitation.updateMany({
          where: {
            channelId,
            inviteeId,
            acceptedAt: null,
            expiresAt: { lte: now },
          },
          data: { invitedById: userId, createdAt: now, expiresAt },
        });
        if (renewed.count === 1) {
          return tx.channelInvitation.findUniqueOrThrow({
            where: { channelId_inviteeId: { channelId, inviteeId } },
          });
        }
        return tx.channelInvitation.create({
          data: { channelId, inviteeId, invitedById: userId, expiresAt },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An invitation already exists for this user.',
        );
      }
      throw error;
    }
  }

  listPending(userId: string) {
    return this.prisma.channelInvitation.findMany({
      where: {
        inviteeId: userId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        channel: { select: { id: true, name: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(userId: string, invitationId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.channelInvitation.findUnique({
          where: { id: invitationId },
        });
        if (!invitation || invitation.inviteeId !== userId) {
          throw new NotFoundException('Invitation not found.');
        }
        if (invitation.acceptedAt)
          throw new ConflictException('Invitation already accepted.');
        const now = new Date();
        if (invitation.expiresAt <= now)
          throw new GoneException('Invitation expired.');
        // Lock and consume the invitation atomically before creating membership.
        const accepted = await tx.channelInvitation.updateMany({
          where: {
            id: invitationId,
            inviteeId: userId,
            acceptedAt: null,
            expiresAt: { gt: now },
          },
          data: { acceptedAt: now },
        });
        if (accepted.count !== 1)
          throw new ConflictException('Invitation is no longer available.');
        return tx.channelMember.create({
          data: { channelId: invitation.channelId, userId },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This user is already a channel member.');
      }
      throw error;
    }
  }

  async revoke(userId: string, channelId: string, invitationId: string) {
    await this.requireOwner(userId, channelId);
    const result = await this.prisma.channelInvitation.deleteMany({
      where: { id: invitationId, channelId, acceptedAt: null },
    });
    if (result.count !== 1)
      throw new NotFoundException('Pending invitation not found.');
  }
}
