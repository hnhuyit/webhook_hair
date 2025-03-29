// aiResponder.js
const { askAI } = require("../ai");
const { replyZalo } = require("../zalo");

async function handleAIReply(userId, userMessage) {
  try {
    const aiReply = await askAI(userMessage);     // 🤖 Gọi AI trả lời
    await replyZalo(userId, aiReply);             // 📩 Gửi lại user
    console.log("✅ AI phản hồi:", aiReply);
  } catch (err) {
    console.error("❌ Lỗi phản hồi AI:", err.message);

    // Nếu lỗi do quota/hết tiền
    if (err.message.includes("429") || err.message.includes("quota")) {
      const fallbackMsg = "⚠️ Hiện tại hệ thống AI đang quá tải. Nhân viên thật sẽ hỗ trợ bạn ngay sau ít phút.";
      await replyZalo(userId, fallbackMsg);

      // 🧠 Optional: Gửi thông báo về admin (Zalo OA, Telegram, email...)
      replyZalo("9187775818961242155", "Hệ thống quá tải"); // có thể viết sau
    } else {
      await replyZalo(userId, "⚠️ Xin lỗi, hiện tại hệ thống đang gặp lỗi. Vui lòng thử lại sau.");
    }

  }
}

module.exports = { handleAIReply };
