require("dotenv").config();
const fs = require("fs");

const prompt = fs.readFileSync("./config/systemPrompt.txt", "utf8"); //process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.";
// ai.js (hỗ trợ OpenAI SDK v4+)
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function askAI(message) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o", // hoặc gpt-4 nếu bạn dùng
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: message }
    ]
  });
  return res.choices[0].message.content.trim();
}

module.exports = { askAI };
