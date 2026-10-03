import prisma from '../prismaClient.js';
import { Action } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import { getPaginationParams } from '../utils/pagination.js';
import { createAuditLog } from '../services/audit.service.js';


const getUsers = async (req, res, next) => {
    try {
        const {
            page,
            limit,
            skip
        } = getPaginationParams(req);

        const whereCondition = {
            isDeleted: false
        };

        const [totalCount, users] = await Promise.all([
            prisma.user.count({
                where: whereCondition
            }),

            prisma.user.findMany({
                skip,
                take: limit,
                where: whereCondition,
                orderBy: {
                    id: "desc"
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            data: users,
            meta: {
                page,
                limit,
                totalCount,
                totalPages
            }
        });

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const getUserById = async (req, res, next) => {
    try {
        // Read the user ID from the URL / قراءة User ID من الرابط
        const id = Number(req.params.id);

        // Find only active users / البحث عن المستخدمين غير المحذوفين فقط
        const user = await prisma.user.findFirst({
            where: {
                id,
                isDeleted: false
            },

            select: { // تحديد البيانات المطلوبة بدون Password
                id: true,
                username: true,
                email: true,
                role: true
            }
        });

        // Return 404 if the user does not exist
        // إرجاع 404 إذا لم يكن المستخدم موجودًا
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                data: null
            });
        }

        // Record the view action / تسجيل عملية مشاهدة المستخدم
        await createAuditLog(
            req.user.id,
            Action.VIEW,
            "User",
            id
        );

        res.json(user);

    } catch (err) {
        // Send unexpected errors to the central handler
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const id= parseInt(req.params.id);

        const {
            username,
            email,
            role,
            password
        } = req.body;

        const data = {
            username,
            email,
            role
        };

        if (password) {
            data.password = await bcrypt.hash(password, 10); //هون اذا تحقق الشرط بنضاف الباسوورد للداتا المطلوبة عشان اعدل عاليوزر 
        }

const existingUser = await prisma.user.findFirst({
    where: {
        id: id,
        isDeleted: false
    }
});

        if (!existingUser) {
            return res.status(404).json({
                                       message: "User not found",
                           data: null
            });
        }

        //هون خلينا الباسوورد اختياري عشان نعدل بيانات اليوزر 
        const updatedUser = await prisma.user.update({
            where: {
                id: id
            },
            data,
            select: {
                id: true,
                username: true,
                email: true,
                role: true
            }
        });

        await createAuditLog(
            req.user.id,
            Action.UPDATE,
            "User",
            id
        );

        res.send(updatedUser);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const deleteUser = async (req, res, next) => {
    const id = Number(req.params.id);

    //هون خليتها ابديت عشان السوفت ديليت يزبط
    //لو ظلت ديليت بصير هارد هديليت يعني بنحذف كله من الداتابيس
    try {
        const deletedUser = await prisma.$transaction(async (transaction) => {
            // Soft delete the user inside the transaction.
            const user = await transaction.user.update({
                where: {
                    id: id
                },
                data: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            });

            // Create the audit log inside the same transaction.
            await transaction.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: Action.DELETE,
                    entity: "User",
                    entityId: id
                }
            });

            // Return the updated user after both operations succeed.
            return user;

            });

        //const createAuditLog = async (userId, action, entity, entityId)
        // 1-req.user.id  هي نفسها (req.user = decoded)   >>> this is authenticated user id (here is the admin) (who has the JWT )  NOT the deleted user Id
        // 1- req.user = decoded; <<<< inside AuthMiddleWare
        //
        //2-(prisma.action.DELETE)  is wrong cuz it's enum and we require the enum using (action.DELETE)
        //
        //3-"User" is the deleted entity name,,,   entity "Sting" from auditLog table
        //
        // 4-id >>> this is the deleted user id

        res.send({
            message: `user ${id} , ${deletedUser.username} deleted, ${deletedUser.role}`
        });

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const restoreUser = async (req, res, next) => {
    try {
        // Read the user ID from the route parameter.
        const id = Number(req.params.id);

        // Find only users that are currently soft-deleted.
        const deletedUser = await prisma.user.findFirst({
            where: {
                id: id,
                isDeleted: true
            }
        });

        // Return 404 if the user does not exist
        // or is already active.
        if (!deletedUser) {
            return res.status(404).json({
                message: "Deleted user not found",
                data: null
            });
        }

        // Restore the user by resetting the soft-delete fields.
        const restoredUser = await prisma.user.update({
            where: {
                id: id
            },
            data: {
                isDeleted: false,
                deletedAt: null
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isDeleted: true,
                deletedAt: true
            }
        });

        // Use UPDATE because RESTORE is not currently part of the Action enum.
        await createAuditLog(
            req.user.id,
            Action.RESTORE,
            "User",
            id
        );

        res.status(200).json({
            message: "User restored successfully",
            data: restoredUser
        });

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        return next(err);
    }
};

//فإذا بدنا نجيب User ومعه كل الـArticles تبعته

const getUserWithArticles = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // A regular USER can only see published articles in this list.
        // الـ USER العادي لا يرى مسودات المستخدمين داخل هذه القائمة.
        const articlesWhere = req.user.role === "USER"
            ? { isPublished: true }
            : {};

        const user = await prisma.user.findFirst({
            where: {
                id: id,
                isDeleted: false
            },

            select: {
                id: true,
                username: true,
                email: true,
                role: true,

                articles: {
                    where: articlesWhere,
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        contentAr: true,
                        contentEn: true,
                        isPublished: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                data: null
            });
        }

        await createAuditLog(
            req.user.id,
            Action.VIEW,
            `User`,
            id
        );

        res.send(user);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

export {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    restoreUser,
    getUserWithArticles
};
