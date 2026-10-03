import { io } from "socket.io-client";

// Pass a valid Access Token from the /login response, e.g. (PowerShell):
//   $env:ACCESS_TOKEN="<token>"; node socket-test.mjs
// ضع Access Token صحيحة من Response الخاص بالـ Login
const accessToken = process.env.ACCESS_TOKEN;

if (!accessToken) {
    console.error("Set ACCESS_TOKEN first (copy it from the /login response).");
    process.exit(1);
}

const socket = io("http://localhost:9999", {
    auth: {
        token: accessToken
    }
});

// Confirm that the Socket connection succeeded.
// التأكد أن اتصال Socket نجح
socket.on("connect", () => {
    console.log("Connected:", socket.id);

    // Join a conversation after connecting.
    // الانضمام إلى المحادثة بعد الاتصال
    socket.emit(
        "join_conversation",
        1,
        (response) => {
            console.log("Join response:", response);

            if (response.success) {

                // Mark messages from the other user as read.
                // تعليم رسائل المستخدم الآخر كمقروءة
                socket.emit(
                    "mark_messages_read",
                    1,
                    (readResponse) => {
                        console.log("Read response:", readResponse);
                    }
                );

                // Send a message after joining successfully.
                // إرسال رسالة بعد نجاح الانضمام
                socket.emit(
                    "send_message",
                    {
                        conversationId: 1,
                        content: "Hello from Node.js test client"
                    },
                    (sendResponse) => {
                        console.log("Send response:", sendResponse);
                    }
                );
            }
        }
    );
});

// Receive messages sent to the conversation room.
// استقبال الرسائل المرسلة إلى Room المحادثة
socket.on("new_message", (message) => {
    console.log("New message:", message);
});

// Receive the messages_read event.
// استقبال Event الخاص بتحديث الرسائل كمقروءة
socket.on("messages_read", (data) => {
    console.log("Messages read event:", data);
});

// Show connection errors.
// عرض أخطاء الاتصال
socket.on("connect_error", (error) => {
    console.error("Connection failed:", error.message);
});