// aiResponder.js
const { askAI } = require("../ai");
const { replyZalo } = require("../zalo");

async function handleAIReply(userId, userMessage, prompt, token) {
  try {
    const aiReply = await askAI(userMessage, prompt);     // 🤖 Gọi AI trả lời
    try {
      await replyZalo(userId, aiReply, token);       // 📩 Gửi cho người dùng
      console.log("✅ AI phản hồi:", aiReply);
    } catch (sendErr) {
      console.error("❌ Lỗi khi gửi phản hồi cho user:", sendErr.message);
    }
  } catch (err) {
    console.error("❌ Lỗi phản hồi AI:", err.message);

    const fallbackMsg = err.message.includes("429") || err.message.includes("quota")
      ? "⚠️ Hiện tại hệ thống AI đang quá tải. Nhân viên thật sẽ hỗ trợ bạn ngay sau ít phút."
      : "⚠️ Xin lỗi, hiện tại hệ thống đang gặp lỗi. Vui lòng thử lại sau.";
    
    try {
      await replyZalo(userId, fallbackMsg);
    } catch (fallbackErr) {
      console.error("❌ Lỗi khi gửi fallback cho user:", fallbackErr.message);
    }

    try {
      await replyZalo("9187775818961242155", `⚠️ AI lỗi với user ${userId}: ${userMessage}`);
    } catch (adminErr) {
      console.error("❌ Lỗi khi gửi cảnh báo cho admin:", adminErr.message);
    }
  }
}

module.exports = { handleAIReply };
