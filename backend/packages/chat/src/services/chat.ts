import {prisma, ServiceError, CommonErrors, CommonErrorCode, ErrorCode, ErrorMessage} from '@puppy-store/shared';

// Uses only common error codes (NOT_FOUND, FORBIDDEN)
export const ChatErrors = CommonErrors;
export type ChatErrorCode = CommonErrorCode;

export class ChatError extends ServiceError<ChatErrorCode> {
  constructor(code: ChatErrorCode, message: string) {
    super(code, message, ChatErrors[code]);
    this.name = 'ChatError';
  }
}

export async function getOrCreateChatRoom(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: {id: applicationId},
    include: {
      puppy: {select: {posterId: true}},
      chatRoom: {
        include: {
          messages: {
            include: {sender: {select: {id: true, name: true}}},
            orderBy: {createdAt: 'asc'},
          },
        },
      },
    },
  });

  if (!application) {
    throw new ChatError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Application'));
  }

  const isApplicant = application.applicantId === userId;
  const isPoster = application.puppy.posterId === userId;

  if (!isApplicant && !isPoster) {
    throw new ChatError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  let chatRoom = application.chatRoom;
  if (!chatRoom) {
    chatRoom = await prisma.chatRoom.create({
      data: {applicationId},
      include: {messages: {include: {sender: {select: {id: true, name: true}}}}},
    });
  }

  return chatRoom;
}

export async function createMessage(applicationId: string, senderId: string, content: string) {
  let chatRoom = await prisma.chatRoom.findUnique({
    where: {applicationId},
    include: {
      application: {include: {puppy: {select: {posterId: true}}}},
    },
  });

  if (!chatRoom) {
    const application = await prisma.application.findUnique({
      where: {id: applicationId},
      include: {puppy: {select: {posterId: true}}},
    });

    if (!application) {
      throw new ChatError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Application'));
    }

    const isApplicant = application.applicantId === senderId;
    const isPoster = application.puppy.posterId === senderId;

    if (!isApplicant && !isPoster) {
      throw new ChatError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
    }

    chatRoom = await prisma.chatRoom.create({
      data: {applicationId},
      include: {application: {include: {puppy: {select: {posterId: true}}}}},
    });
  }

  const isApplicant = chatRoom.application.applicantId === senderId;
  const isPoster = chatRoom.application.puppy.posterId === senderId;

  if (!isApplicant && !isPoster) {
    throw new ChatError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      senderId,
      chatRoomId: chatRoom.id,
    },
    include: {sender: {select: {id: true, name: true}}},
  });

  return {chatRoomId: chatRoom.id, message};
}
