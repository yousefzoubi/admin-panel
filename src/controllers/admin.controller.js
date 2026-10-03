import prisma from '../prismaClient.js';
import { getPaginationParams } from '../utils/pagination.js';


const getAuditLogs = async (req, res, next) => {
    try {
        const {
            page,
            limit,
            skip
        } = getPaginationParams(req);

        const [totalCount, auditLogs] = await Promise.all([
            prisma.auditLog.count(),

            prisma.auditLog.findMany({
                skip,
                take: limit,

                // Show the newest logs first.
                // عرض أحدث السجلات أولًا
                orderBy: {
                    id: "desc"
                },

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
            })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            data: auditLogs,
            meta: {
                page,
                limit,
                totalCount,
                totalPages
            }
        });

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        // إرسال الأخطاء غير المتوقعة إلى معالج الأخطاء المركزي
        return next(err);
    }
};

// Return dashboard totals without exposing users, logs, conversations, or messages.
// Audit totals remain permission-aware: callers without audit.read receive null.
const getDashboardStats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const canReadAudit = Array.isArray(req.user.permissions)
            ? req.user.permissions.includes("audit.read")
            : req.user.role === "ADMIN";

        const [totalUsers, totalConversations, totalOperations] = await Promise.all([
            prisma.user.count({ where: { isDeleted: false } }),
            prisma.conversationMember.count({ where: { userId } }),
            canReadAudit ? prisma.auditLog.count() : Promise.resolve(null)
        ]);

        return res.status(200).json({
            data: { totalUsers, totalConversations, totalOperations }
        });
    } catch (err) {
        return next(err);
    }
};

export {
    getAuditLogs,
    getDashboardStats
};
