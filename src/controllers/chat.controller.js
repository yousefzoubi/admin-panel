import prisma from '../prismaClient.js';
import { getPaginationParams } from '../utils/pagination.js';
import { emitToConversation, joinUsersToConversation } from '../realtime.js';


const createConversation = async (req, res, next) => {
    try {
        // participantId comes from the Client.
        const { participantId } = req.body;

        // req.user.id comes from the verified Access Token.
        const currentUserId = req.user.id;
        const conversationKey = [currentUserId, participantId].sort((a, b) => a - b).join(":");


        // منع المستخدم من إنشاء محادثة مع نفسه
        if (participantId === currentUserId) {
            return res.status(400).json({
                message: "You cannot create a conversation with yourself",
                data: null
            });
        }

        // Make sure the other user exists and is not soft-deleted.
        // التأكد أن المستخدم الآخر موجود وغير محذوف
        const participant = await prisma.user.findFirst({
            where: {
                id: participantId,
                isDeleted: false
            },
            select: {
                id: true,
                username: true,
                email: true
            }
        });

        if (!participant) {
            return res.status(404).json({
                message: "Participant not found",
                data: null
            });
        }

        const conversationInclude = {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            role: true,
                            createdAt: true
                        }
                    }
                }
            }
        };

        // Check both the deterministic key and legacy conversations that were
        // created before conversationKey existed.
        const existingConversation = await prisma.conversation.findFirst({
            where: {
                OR: [
                    { conversationKey },
                    {
                        AND: [
                            { members: { some: { userId: currentUserId } } },
                            { members: { some: { userId: participantId } } }
                        ]
                    }
                ]
            },
            include: conversationInclude,
            orderBy: { id: "asc" }
        });

        if (existingConversation) {
            return res.status(200).json({
                message: "Conversation already exists",
                existing: true,
                data: existingConversation
            });
        }

        // تنفيذ إنشاء المحادثة والأعضاء كعملية واحدة
        const conversation = await prisma.$transaction(async (transaction) => {
            // إنشاء محادثة جديدة
            const newConversation = await transaction.conversation.create({
                data: { conversationKey }
            });

            // إضافة المستخدم الحالي والمستخدم الآخر إلى المحادثة
            await transaction.conversationMember.createMany({
                data: [
                    {
                        conversationId: newConversation.id,
                        userId: currentUserId
                    },
                    {
                        conversationId: newConversation.id,
                        userId: participantId
                    }
                ]
            });

            // Return the conversation with its members
            return transaction.conversation.findUnique({
                where: {
                    id: newConversation.id
                },
                include: conversationInclude
            });
        });

        // Both members are already connected, so add their sockets to the new room now.
        // العضوين ممكن يكونوا متصلين حاليًا، فندخل Sockets تبعهم على Room المحادثة الجديدة
        // بدون هذه الخطوة ما يوصلهم new_message إلا بعد Refresh
        await joinUsersToConversation([currentUserId, participantId], conversation.id);

        return res.status(201).json({
            message: "Conversation created successfully",
            data: conversation
        });

    } catch (err) {
        // إرسال الأخطاء غير المتوقعة إلى Error Handler
        return next(err);
    }
};

const getMyConversations = async (req, res, next) => {
    try {
        // Get the authenticated user's ID from the verified token.
        // أخذ رقم المستخدم الحالي من الـ Token الموثقة
        const userId = req.user.id;

        // Find only conversations where the current user is a member.
        // جلب المحادثات التي ينتمي إليها المستخدم الحالي فقط
        const memberships = await prisma.conversationMember.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                joinedAt: "desc"
            },
            include: {
                conversation: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true,
                                        email: true,
                                        role: true,
                                        createdAt: true
                                    }
                                }
                            }
                        },

                        // Get the latest message in the conversation.
                        // جلب آخر رسالة داخل المحادثة
                        messages: {
                            orderBy: {
                                createdAt: "desc"
                            },
                            take: 1,
                            select: {
                                id: true,
                                content: true,
                                senderId: true,
                                conversationId: true,
                                createdAt: true,
                                isRead: true,
                                readAt: true
                            }
                        },

                        // Count unread messages sent by other users.
                        // حساب الرسائل غير المقروءة القادمة من المستخدم الآخر
                        _count: {
                            select: {
                                messages: {
                                    where: {
                                        senderId: {
                                            not: userId
                                        },
                                        isRead: false
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Remove the membership wrapper and return conversations directly.
        // إزالة غلاف العضوية وإرجاع المحادثات مباشرة
        const conversations = memberships.map((membership) => {
            const {
                _count,
                messages,
                ...conversation
            } = membership.conversation;

            return {
                ...conversation,
                unreadCount: _count?.messages ?? 0,
                lastMessage: messages[0] || null
            };
        });

        //نفس الكود بس باستخدام loop
        // const conversations = [];
        // for (const membership of memberships) {
        //     conversations.push(membership.conversation);
        //}

        return res.status(200).json({
            data: conversations
        });

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

const deleteConversation = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        const membership = await prisma.conversationMember.findUnique({
            where: {
                userId_conversationId: {
                    userId: req.user.id,
                    conversationId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({
                message: "You are not a member of this conversation",
                data: null
            });
        }

        await prisma.conversation.delete({ where: { id: conversationId } });
        return res.status(200).json({ message: "Conversation deleted successfully", data: null });
    } catch (err) {
        return next(err);
    }
};



const getConversationMessages = async (req, res, next) => {
    try {
        // Read the conversation ID from the URL.
        const conversationId = Number(req.params.id);

        // Read and calculate pagination values.
        const { page, limit, skip } = getPaginationParams(req);

        // Check whether the authenticated user belongs to this conversation.
        //التأكد من membership
        const membership = await prisma.conversationMember.findUnique({
            where: {
                userId_conversationId: {
                    userId: req.user.id,
                    conversationId: conversationId
                }
            }
        });

        // Do not allow non-members to read the conversation messages.
        if (!membership) {
            return res.status(403).json({
                message: "You are not a member of this conversation",
                data: null
            });
        }

        // Count messages and fetch the current page in parallel.
        // حساب عدد الرسائل وجلب الصفحة الحالية بالتوازي
        const [totalCount, messages] = await Promise.all([
            prisma.message.count({
                where: {
                    conversationId: conversationId
                }
            }),

            prisma.message.findMany({
                where: {
                    conversationId: conversationId
                },
                skip: skip,
                take: limit,
                orderBy: [
                    { createdAt: "desc" },
                    { id: "desc" }
                ],
                select: {
                    id: true,
                    content: true,
                    senderId: true,
                    conversationId: true,
                    createdAt: true,
                    isRead: true,
                    readAt: true,
                    sender: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            }).then((latestFirstMessages) => latestFirstMessages.reverse())
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            data: messages,
            meta: {
                page: page,
                limit: limit,
                totalCount: totalCount,
                totalPages: totalPages
            }
        });

    } catch (err) {
        return next(err);

    }
};


const createMessage = async (req, res, next) => {
    try {
        // Read the conversation ID from the URL.
        const conversationId = Number(req.params.id);

        // Read the message content from the request body.
        const { content } = req.body;

        // The sender ID comes from the verified Access Token.
        const senderId = req.user.id;

        // Check whether the sender belongs to this conversation.
        const membership = await prisma.conversationMember.findUnique({
            where: {
                userId_conversationId: {
                    userId: senderId,
                    conversationId: conversationId
                }
            }
        });


        // Do not allow non-members to send messages.
        if (!membership) {
            return res.status(403).json({
                message: "You are not a member of this conversation",
                data: null
            });
        }

        // Create the message with the authenticated user as the sender.
        const message = await prisma.message.create({
            data: {
                content: content.trim(),
                senderId: senderId,
                conversationId: conversationId
            },
            select: {
                id: true,
                content: true,
                senderId: true,
                conversationId: true,
                createdAt: true,
                isRead: true,
                readAt: true,
                sender: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });

        // Deliver the message in real time even when the sender used the HTTP fallback.
        // إرسال الرسالة لحظيًا حتى لو المرسل استخدم HTTP بدل Socket
        emitToConversation(conversationId, "new_message", message);

        return res.status(201).json({
            message: "Message created successfully",
            data: message
        });

    } catch (err) {
        return next(err);
    }
};


const markConversationRead = async (req, res, next) => {
    try {
        // Read the conversation ID from the URL.
        const conversationId = Number(req.params.id);

        // The reader ID comes from the verified Access Token.
        const userId = req.user.id;

        // Check whether the current user belongs to this conversation.
        // التأكد أن المستخدم الحالي عضو في المحادثة
        const membership = await prisma.conversationMember.findUnique({
            where: {
                userId_conversationId: {
                    userId: userId,
                    conversationId: conversationId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({
                message: "You are not a member of this conversation",
                data: null
            });
        }

        // Use one timestamp for all messages marked as read.
        // استخدام نفس وقت القراءة لكل الرسائل
        const readAt = new Date();

        // Mark only unread messages sent by other users as read.
        // تعليم الرسائل غير المقروءة من المستخدمين الآخرين كمقروءة
        const result = await prisma.message.updateMany({
            where: {
                conversationId: conversationId,
                senderId: {
                    not: userId
                },
                isRead: false
            },
            data: {
                isRead: true,
                readAt: readAt
            }
        });

        // Notify the sender so the read indicator updates without a refresh.
        // إبلاغ المرسل حتى يتحدث مؤشر القراءة بدون Refresh
        emitToConversation(conversationId, "messages_read", {
            conversationId: conversationId,
            userId: userId,
            readAt: readAt,
            count: result.count
        });

        return res.status(200).json({
            message: "Messages marked as read",
            data: {
                count: result.count,
                readAt: readAt
            }
        });

    } catch (err) {
        return next(err);
    }
};

export {
    createConversation,
    getMyConversations,
    deleteConversation,
    getConversationMessages,
    createMessage,
    markConversationRead
};
