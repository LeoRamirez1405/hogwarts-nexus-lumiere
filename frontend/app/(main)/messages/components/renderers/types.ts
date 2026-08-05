"use client";

import type { Message, MessageReaction, ChatRoomMemberResponse } from "@/lib/api/messagesTypes";

export type MessageKind = Message["kind"];

export interface PollViewProps {
  poll: Message["poll"];
  isOwn: boolean;
  messageId: string;
  onVoteChange?: (messageId: string, updatedPoll: NonNullable<Message["poll"]>) => void;
}

export interface StickerViewProps {
  sticker: string;
}

export interface VoiceViewProps {
  message: Message;
  isOwn: boolean;
}

export interface DocumentViewProps {
  message: Message;
  isOwn: boolean;
}

export interface PostShareViewProps {
  message: Message;
  isOwn: boolean;
}

export interface ImageViewProps {
  url: string;
  isOwn: boolean;
  dataSaver?: boolean;
  shouldLoad?: boolean;
  onLoadClick?: () => void;
}

export interface VideoViewProps {
  message: Message;
  isOwn: boolean;
  dataSaver?: boolean;
  shouldLoad?: boolean;
  onLoadClick?: () => void;
  onOpenFullscreen?: () => void;
}

export interface AudioViewProps {
  url: string;
  isOwn: boolean;
  dataSaver?: boolean;
  shouldLoad?: boolean;
  onLoadClick?: () => void;
}

export interface ReplyPreviewProps {
  message: Message;
  onScrollToMessage?: (id: string) => void;
}

export interface ReactionBarProps {
  reactions: MessageReaction[];
  messageId: string;
  onReacted?: () => void;
}

export interface ReactionPickerProps {
  messageId: string;
  onReacted?: () => void;
}

export interface MentionTextProps {
  text: string;
  isOwn: boolean;
  members?: ChatRoomMemberResponse[];
}

export interface MessageActionsProps {
  message: Message;
  isOwn: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onReply?: (msg: Message) => void;
  onTogglePin?: (msg: Message) => void;
  onToggleStar?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onReactionChange?: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isReplyTarget?: boolean;
  onReply?: (msg: Message) => void;
  onReactionChange?: () => void;
  onScrollToMessage?: (id: string) => void;
  onTogglePin?: (msg: Message) => void;
  onToggleStar?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onPollVote?: (messageId: string, updatedPoll: NonNullable<Message["poll"]>) => void;
  members?: ChatRoomMemberResponse[];
  editing?: boolean;
  onSaveEdit?: (messageId: string, body: string) => void;
  onCancelEdit?: () => void;
}