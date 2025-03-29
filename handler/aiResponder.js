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
  }
}

module.exports = { handleAIReply };
