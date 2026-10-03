import prisma from '../prismaClient.js';
import { Action } from '../generated/prisma/index.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createAuditLog } from '../services/audit.service.js';

// Role permissions:
// ADMIN     -> Can manage users, restore users, manage all articles, and read audit logs.
// MODERATOR -> Can read, update, and delete any article.
// EDITOR    -> Can read, create, update, and delete articles they own.
// USER      -> Can read, create, update, and delete articles they own.
//
// Important:
// requirePermission checks whether the role has the requested action.
// requireArticleOwner checks whether the article belongs to the current user.
// ADMIN and MODERATOR can manage any article.
// USER and EDITOR can manage their own articles only.


const insertArticle = async (req, res, next) => {
    try {
        //هاي القديمة كانت بتسمح لليوزر يعمل وحدة باسم يوزر ثاني ولغيناها وحطينا الجديدة اللي بتسمحله يحط بيانات محددة بس
        /* const article = await prisma.article.create({
             data: req.body
         })*/

        const {
            titleAr,
            titleEn,
            contentAr,
            contentEn
        } = req.body;

        //const article = await prisma.$transaction(async (transaction) => {

            // Create article here
            const article = await prisma.article.create({
                data: {
                    titleAr,
                    titleEn,
                    contentAr,
                    contentEn,
                    userId: req.user.id
                }
            });

            // Create audit log here
            await prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: Action.CREATE,
                    entity: "Article",
                    entityId: article.id
                }
            });

            // Return the created article
          //  return createdArticle;


        res.send(article);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const getArticles = async (req, res, next) => {
    try {
        const {
            page,
            limit,
            skip
        } = getPaginationParams(req);

        // Return articles owned by active users only
        // إرجاع مقالات المستخدمين غير المحذوفين فقط
        const whereCondition = {
            user: {
                isDeleted: false
            }
        };

        // If the logged-in user is a regular USER, show only published articles
        // إذا كان المستخدم USER عادي، إرجاع المقالات المنشورة فقط
        if (req.user.role === "USER") {
            whereCondition.isPublished = true;
        }

        const [totalCount, articles] = await Promise.all([
            prisma.article.count({
                where: whereCondition
            }),

            prisma.article.findMany({
                skip,
                take: limit,
                where: whereCondition,

                // Keep pagination order stable / تثبيت ترتيب النتائج
                orderBy: {
                    id: "desc"
                },

                select: {
                    id: true,
                    titleAr: true,
                    titleEn: true,
                    contentAr: true,
                    contentEn: true,
                    isPublished: true,
                    createdAt: true,
                    updatedAt: true,

                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            data: articles,
            meta: {
                page,
                limit,
                totalCount,
                totalPages
            }
        });

    } catch (err) {
        // Send unexpected errors to the central handler
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

const getArticleById = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // Regular USER accounts must not access unpublished drafts by ID.
        // الـ USER العادي يرى المقالات المنشورة فقط، حتى لو عرف ID المسودة.
        const whereCondition = {
            id: id,
            user: {
                isDeleted: false
            }
        };

        if (req.user.role === "USER") {
            whereCondition.isPublished = true;
        }

        const article = await prisma.article.findFirst({
            where: whereCondition,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!article) {
            return res.status(404).json({
                message: "article not found",
                data: null
            });
        }

        await createAuditLog(req.user.id, Action.VIEW, "Article", id);

        res.send(article);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const updateArticle = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        //الكود القديم اللي كان ممكن يسمح للمستخدم بتعديل حقول ما بدنا إياه يعدلها، وأهمها اليوزر
        //نفس المشكلة اللي كانت عند insertArticle 
        /*كود قديم
        const updatedArticle = await prisma.article.update({
            where: {
                id: id
            },
            data: req.body
        });
        */

        //هون عدلناه بحيث نحدد الحقول المسموح تعديلها وبس 
        const {
            titleAr,
            titleEn,
            contentAr,
            contentEn
        } = req.body;

        const updatedArticle = await prisma.article.update({
            where: {
                id: id
            },
            data: {
                titleAr,
                titleEn,
                contentAr,
                contentEn
            }
        });

        await createAuditLog(
            req.user.id,
            Action.UPDATE,
            "Article",
            id
        );

        res.send(updatedArticle);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const deleteArticle = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        const deletedArticle = await prisma.article.delete({
            where: {
                id: id
            }
        });

        await createAuditLog(
            req.user.id,
            Action.DELETE,
            "Article",
            id
        );

        res.send(deletedArticle);

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const publishArticle = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // 1. تحديث حالة المقال في قاعدة البيانات ليصبح منشوراً
        const publishedArticle = await prisma.article.update({
            where: {
                id: id
            },
            data: {
                isPublished: true
            }
        });

        // 2. تسجيل العملية في Audit Logs
        await createAuditLog(
            req.user.id,
            Action.UPDATE,
            "Article - Published",
            id
        );

        // 3. إرسال الاستجابة بنجاح
        res.status(200).json({
            message: "Article published successfully",
            data: publishedArticle
        });

    } catch (err) {
        // إرسال الخطأ إلى Error Handler المركزي
        return next(err);
    }
};

const unpublishArticle = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        // 1. تحديث حالة المقال في قاعدة البيانات لإرجاعه إلى مسودة
        const unpublishedArticle = await prisma.article.update({
            where: {
                id: id
            },
            data: {
                isPublished: false
            }
        });

        // 2. تسجيل العملية في Audit Logs
        await createAuditLog(
            req.user.id,
            Action.UPDATE,
            "Article - Unpublished",
            id
        );

        // 3. إرسال الاستجابة بنجاح
        res.status(200).json({
            message: "Article unpublished successfully",
            data: unpublishedArticle
        });

    } catch (err) {
        // إرسال الخطأ إلى Error Handler المركزي
        return next(err);
    }
};

export {
    insertArticle,
    getArticles,
    getArticleById,
    updateArticle,
    deleteArticle,
    publishArticle,
    unpublishArticle
};
