import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ChannelsService } from './channels.service.js';
import {
  ChannelListItemResponseDto,
  ChannelMemberResponseDto,
  ChannelResponseDto,
} from './dto/channel-response.dto.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new channel (creator auto-joins)' })
  @ApiResponse({ status: 201, type: ChannelResponseDto })
  @ApiResponse({ status: 409, description: 'Channel name already taken' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List public channels plus private channels the user has joined',
  })
  @ApiResponse({ status: 200, type: [ChannelListItemResponseDto] })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, description: 'Last channel id from previous page' })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.channelsService.findAllForUser(user.id, {
      limit: limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
      cursor,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single channel by id' })
  @ApiResponse({ status: 200, type: ChannelResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this private channel',
  })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.findOneForUser(user.id, id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an existing (public) channel' })
  @ApiResponse({ status: 201, type: ChannelMemberResponseDto })
  @ApiResponse({ status: 403, description: 'Channel is private' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  join(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.join(user.id, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of a channel' })
  @ApiResponse({ status: 200, type: [ChannelMemberResponseDto] })
  @ApiResponse({ status: 403, description: 'Not a member of this private channel' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  listMembers(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.channelsService.listMembers(user.id, id, {
      limit: limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset, 10) || 0 : 0,
    });
  }
}
