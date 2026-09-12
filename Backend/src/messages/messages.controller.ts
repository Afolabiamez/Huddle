import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { MessagePageResponseDto } from './dto/message-page-response.dto.js';
import { MessagesService } from './messages.service.js';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to a channel (must be a member)' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  send(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.send(user.id, channelId, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Read messages in a channel, newest page first (cursor pagination)',
  })
  @ApiResponse({ status: 200, type: MessagePageResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('channelId') channelId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.findForChannel(user.id, channelId, query);
  }
}
