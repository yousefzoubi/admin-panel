import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    family: 4,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// Verify the SMTP connection when the server starts.
// فحص اتصال SMTP عند تشغيل السيرفر بدون إظهار كلمة المرور
transporter.verify((error) => {
    if (error) {
        console.error("SMTP connection failed:", error.message);
    } else {
        console.log("SMTP server is ready");
    }
});

// Show safe SMTP configuration details for development debugging.
// عرض معلومات آمنة للتأكد من تحميل إعدادات SMTP
console.log({
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    hasSmtpPassword: Boolean(process.env.SMTP_PASSWORD)
});

const sendLoginOtpEmail = async (recipientEmail, otp) => {
    await transporter.sendMail({
        from: `"MindSpace" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: "Your MindSpace Login OTP",
        text: `Your login OTP is: ${otp}. It expires in 5 minutes.`,
        html: `
            <div>
                <h2>MindSpace Login Verification</h2>
                <p>Your login OTP is:</p>
                <h1>${otp}</h1>
                <p>This code expires in 5 minutes.</p>
            </div>
        `
    });
};

export {
    sendLoginOtpEmail
};
