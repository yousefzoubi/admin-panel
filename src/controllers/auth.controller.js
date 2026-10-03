import prisma from '../prismaClient.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createLoginOtp, verifyLoginOtp } from '../services/otp.service.js';
import { createAuthTokens } from '../services/auth.service.js';


const registerUser = async (req, res, next) => {
    try {
        const {
            username,
            email,
            password
        } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
            }
        });

        res.status(200).json({
            message: "successfuly regestered",
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

const loginUser = async (req, res, next) => {
    try {
        const {
            email,
            password
        } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                email: email
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                password: true,
                isDeleted: true
            }
        });

        // Reject missing or soft-deleted users.
        // رفض المستخدم غير الموجود أو المحذوف منطقيًا
        if (!user || user.isDeleted) {
            return res.status(401).json({
                message: "Invalid email or password",
                data: null
            });
        }

        // Compare the password sent by the client with the hashed password.
        // مقارنة كلمة المرور القادمة مع كلمة المرور المشفرة
        const isValidPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!isValidPassword) {
            return res.status(401).json({
                message: "Invalid email or password",
                data: null
            });
        }
        const bypassEmails = (process.env.OTP_BYPASS_EMAILS || "")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);

        const isOtpBypassed =
            process.env.NODE_ENV !== "production" &&
            bypassEmails.includes(user.email.toLowerCase());

        if (!isOtpBypassed) {
            await createLoginOtp(user.id, user.email);

            return res.status(200).json({
                message: "OTP required",
                otpRequired: true,
                userId: user.id
            });
        }

        // Bypass OTP only for configured development accounts.
        // تجاوز OTP فقط للحسابات التجريبية المحددة في بيئة التطوير
        const tokens = await createAuthTokens(user);

        return res.status(200).json({
            message: "Successfully logged in",
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

const verifyLoginOtpController = async (req, res, next) => {
    try {
        const {
            userId,
            otp
        } = req.body;

        // Validate the OTP request data.
        // التحقق من البيانات القادمة لفحص OTP
        if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            typeof otp !== "string" ||
            !/^\d{6}$/.test(otp.trim())
        ) {
            return res.status(400).json({
                message: "Valid userId and six-digit OTP are required",
                data: null
            });
        }

        // Verify the OTP using the OTP service.
        // التحقق من OTP باستخدام خدمة OTP
        const result = await verifyLoginOtp(
            userId,
            otp.trim()
        );

        // Reject invalid, expired, or already used OTPs.
        // رفض OTP الخاطئ أو المنتهي أو المستخدم مسبقًا
        if (!result.success) {
            return res.status(401).json({
                message: result.reason,
                data: null
            });
        }

        // Fetch the user after successful OTP verification.
        // جلب المستخدم بعد نجاح التحقق من OTP
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isDeleted: true
            }
        });

        // Make sure the user still exists and is active.
        // التأكد من أن المستخدم ما زال موجودًا وفعالًا
        if (!user || user.isDeleted) {
            return res.status(401).json({
                message: "User is not active",
                data: null
            });
        }

        // Create tokens only after password and OTP verification.
        // إنشاء التوكنات بعد نجاح كلمة المرور وOTP
        const tokens = await createAuthTokens(user);

        return res.status(200).json({
            message: "Successfully logged in",
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

//give it Refresh token to create a new valid Access token

// Access Token = short-lived permission to use protected API endpoints.

// Refresh Token = proof that the user's session is still valid
//so we can issue a new Access Token without asking for the password again

const refreshAccessToken = async (req, res, next) => {
    try {
        const {
            refreshToken
        } = req.body;

        const storedToken = await prisma.refreshToken.findUnique({
            where: {
                token: refreshToken
            }
        });

        // check if it's exists in the database 
        if (!storedToken) {
            return res.status(401).json({
                message: "Invalid refresh token",
                data: null
            });
        }

        //expiration check
        if (storedToken.expiresAt < new Date()) {
            return res.status(401).json({
                message: "Refresh token expired",
                data: null
            });
        }

        const user = await prisma.user.findUnique({ // to bring role cuz I need it to sign the new access token 
            where: {
                id: storedToken.userId
            },

            select: {
                id: true,
                role: true,
                isDeleted: true
            }
        });



        //defensive check لانه بديهي انه وجود التوكن مرتبط بوجود اليوزر


        if (!user || user.isDeleted) {
            return res.status(401).json({
                    message: "User is not active",
                data: null
            });
        }

        const accessToken = jwt.sign({
            id: storedToken.userId,
            role: user.role
        }, process.env.JWT_SECRET, {
            expiresIn: "15m"
        });

        return res.status(200).json({
            accessToken
        });

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};

//Logout Endpoint , needs to be authentcated to user req.user.id from auth middleware  
const logoutUser = async (req, res, next) => {
    try {
        const {
            refreshToken
        } = req.body;

        // Find the refresh token in the database
        const storedToken = await prisma.refreshToken.findUnique({
            where: {
                token: refreshToken
            }
        });

        // Check if the refresh token exists
        if (!storedToken) {
            return res.status(401).json({
                message: "Invalid refresh token",
                data: null
            });
        }

        // Make sure this refresh token belongs to the authenticated user
        if (storedToken.userId !== req.user.id) {
            return res.status(403).json({
                message: "You are not allowed to logout this session",
                data: null
            });
        }

        // Delete the refresh token
        await prisma.refreshToken.delete({
            where: {
                token: refreshToken
            }
        });

        res.status(200).json({
            message: "Successfully logged out",
            data: null
        });

    } catch (err) {
        // Pass the error to the centralized error handler.
        return next(err);
    }
};



//Access Token >>> to use the protected endpoints.
//Refresh Token >>> to get new access token
//authMiddleware  verifies the access token, not genereting it
//tokens are generated when u login

export {
    registerUser,
    loginUser,
    verifyLoginOtpController,
    refreshAccessToken,
    logoutUser
};
