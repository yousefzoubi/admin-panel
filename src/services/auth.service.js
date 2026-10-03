import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";

// Create access and refresh tokens for an authenticated user.
const createAuthTokens = async (user) => {
    // Access Token is short-lived.
    const accessToken = jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "15m"
        }
    );

    // Refresh Token is a random value stored in the database.
    const refreshToken = crypto
        .randomBytes(64)
        .toString("hex");

    // Refresh Token remains valid for seven days.
    const refreshTokenExpiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // Store the Refresh Token in the database.
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: refreshTokenExpiresAt
        }
    });

    return {
        accessToken,
        refreshToken
    };
};

export {
    createAuthTokens
};