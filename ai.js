require("dotenv").config();
const prompt = process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.";
// ai.js (hỗ trợ OpenAI SDK v4+)
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function askAI(message) {
  const res = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // hoặc gpt-4 nếu bạn dùng
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: message }
    ]
  });
  return res.data.choices[0].message.content.trim();
}

module.exports = { askAI };
