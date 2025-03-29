const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();
const prompt = process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.";

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(config);

async function askAI(message) {
  const res = await openai.createChatCompletion({
    model: "gpt-3.5-turbo", // hoặc gpt-4 nếu bạn dùng
    messages: [
      { role: "system", content: "Bạn là trợ lý thông minh của OA Zalo." },
      { role: "user", content: message }
    ]
  });
  return res.data.choices[0].message.content.trim();
}

module.exports = { askAI };
