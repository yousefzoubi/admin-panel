import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../prismaClient.js";
import {
    sendLoginOtpEmail
} from "./email.service.js";

// Generate a secure six-digit OTP.
const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

// Create and store a new OTP for a user.
const createLoginOtp = async (userId,email) => {
    const otp = generateOtp();

    // Hash the OTP before storing it in the database.
    const codeHash = await bcrypt.hash(otp, 10);

    // The OTP will be valid for five minutes.
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Disable old unused OTPs for the same user.
    await prisma.loginOtp.updateMany({
        where: {
            userId: userId,
            usedAt: null
        },
        data: {
            usedAt: new Date()
        }
    });

    await prisma.loginOtp.create({
        data: {
            userId: userId,
            codeHash: codeHash,
            expiresAt: expiresAt
        }
    });

    // Temporary development output.
    // Later we will send this OTP by email.
    // Send the OTP to the user's email.
// إرسال OTP إلى إيميل المستخدم
    await sendLoginOtpEmail(email, otp);

    return {
        expiresAt
    };
};

// Verify the OTP entered by the user.
const verifyLoginOtp = async (userId, enteredOtp) => {
    // Get the latest unused OTP for this user.
    const loginOtp = await prisma.loginOtp.findFirst({
        where: {
            userId: userId,
            usedAt: null
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    // No active OTP exists.
    if (!loginOtp) {
        return {
            success: false,
            reason: "OTP_NOT_FOUND"
        };
    }

    // The OTP cannot be used after its expiration time.
    if (loginOtp.expiresAt < new Date()) {
        return {
            success: false,
            reason: "OTP_EXPIRED"
        };
    }

    // Prevent unlimited guessing attempts.
    if (loginOtp.attempts >= 5) {
        return {
            success: false,
            reason: "TOO_MANY_ATTEMPTS"
        };
    }

    // Compare the entered OTP with the hashed OTP.
    const isValid = await bcrypt.compare(
        enteredOtp,
        loginOtp.codeHash
    );

    // Increase attempts when the entered code is incorrect.
    if (!isValid) {
        await prisma.loginOtp.update({
            where: {
                id: loginOtp.id
            },
            data: {
                attempts: {
                    increment: 1
                }
            }
        });

        return {
            success: false,
            reason: "INVALID_OTP"
        };
    }

    // Mark the OTP as used so it cannot be reused.
    await prisma.loginOtp.update({
        where: {
            id: loginOtp.id
        },
        data: {
            usedAt: new Date()
        }
    });

    return {
        success: true
    };
};
export {
    generateOtp,
    createLoginOtp,
    verifyLoginOtp
};
