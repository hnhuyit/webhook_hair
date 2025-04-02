// aiResponder.js
const { askAI, askAssistant } = require("../ai");
const { replyZalo } = require("../zalo");

async function handleAIReply(userId, userMessage, prompt, history, token) {
  try {
    const aiReply = await askAI(userMessage, prompt, history);     // 🤖 Gọi AI trả lời
    try {
      await replyZalo(userId, aiReply, token);       // 📩 Gửi cho người dùng
      console.log("✅ AI Assistant phản hồi:", aiReply);
    } catch (sendErr) {
      console.error("❌ Lỗi khi gửi phản hồi cho user:", sendErr.message);
    }
    
    return aiReply; // ✅ RETURN ở đây để save vào Airtable
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

async function handleAssistantReply(userId, userMessage, token) {
  try {
    const assistantReply = await askAssistant(userMessage, userId); // 🤖 Gọi Assistant trả lời

    try {
      await replyZalo(userId, assistantReply, token); // 📩 Gửi phản hồi cho người dùng
      console.log("✅ Assistant phản hồi:", assistantReply);
    } catch (sendErr) {
      console.error("❌ Lỗi khi gửi phản hồi cho user:", sendErr.message);
    }

  } catch (err) {
    console.error("❌ Lỗi khi Assistant xử lý:", err.message);

    const fallbackMsg = err.message.includes("429") || err.message.includes("quota")
      ? "⚠️ Hiện tại hệ thống AI đang quá tải. Nhân viên thật sẽ hỗ trợ bạn ngay sau ít phút."
      : "⚠️ Xin lỗi, hiện tại hệ thống đang gặp lỗi. Vui lòng thử lại sau.";

    try {
      await replyZalo(userId, fallbackMsg, token); // 📩 Gửi fallback cho user
    } catch (fallbackErr) {
      console.error("❌ Lỗi khi gửi fallback cho user:", fallbackErr.message);
    }

    try {
      await replyZalo("9187775818961242155", `⚠️ AI lỗi với user ${userId}: ${userMessage}`, token); // 📩 Báo cho admin
    } catch (adminErr) {
      console.error("❌ Lỗi khi gửi cảnh báo cho admin:", adminErr.message);
    }
  }
}

module.exports = { handleAIReply, handleAssistantReply };
