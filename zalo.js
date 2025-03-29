// zalo.js
const axios = require("axios");
require("dotenv").config(); // nếu chưa gọi trong index.js
const token = process.env.OA_ACCESS_TOKEN;

async function replyZalo(userId, message) {
  try {
    const token = process.env.OA_ACCESS_TOKEN;

    if (!token) {
      throw new Error("⚠️ OA_ACCESS_TOKEN chưa được thiết lập trong .env");
    }

    const res = await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        recipient: { user_id: userId },
        message: { text: message }
      },
      {
        headers: {
          "access_token": token,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("📤 Đã gửi Zalo:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Gửi Zalo thất bại:", err.response?.data || err.message);
  }
}

module.exports = { replyZalo };
