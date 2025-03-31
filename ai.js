require("dotenv").config();
const fs = require('fs');
// const prompt = require("./config/gptService");

// const prompt = fs.readFileSync("./config/systemPrompt.txt", "utf8"); //process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.";
// ai.js (hỗ trợ OpenAI SDK v4+)
const OpenAI = require("openai");
require("dotenv").config();

// const userThreads = JSON.parse(fs.readFileSync('userThreads.json', 'utf-8'));
let userThreads = {};
const raw = fs.readFileSync('userThreads.json', 'utf-8');
if (raw.trim()) {
  userThreads = JSON.parse(raw);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// 🧠 Lấy hoặc tạo thread_id cho user
async function getOrCreateThread(userId) {
  if (userThreads[userId]) return userThreads[userId];

  const thread = await openai.beta.threads.create();
  userThreads[userId] = thread.id;
  fs.writeFileSync('userThreads.json', JSON.stringify(userThreads, null, 2));
  return thread.id;
}

//with Assistant
async function askAssistant(message, userId) {
  // Lấy hoặc tạo thread cho user
  const threadId = await getOrCreateThread(userId);

  // Thêm message của user vào thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message
  });

  // Chạy assistant trên thread
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.ASSISTANT_ID
  });

  // Chờ assistant xử lý xong
  let status = "queued";
  while (status !== "completed") {
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    status = runStatus.status;
    if (status === "failed") throw new Error("Assistant failed");
    await new Promise((res) => setTimeout(res, 1000));
  }

  // Lấy trả lời cuối cùng
  const messages = await openai.beta.threads.messages.list(threadId);
  const reply = messages.data[0].content[0].text.value;

  return reply.trim();
}

//with AI
async function askAI(message, prompt) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini", // hoặc gpt-4 nếu bạn dùng
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: message }
    ]
  });
  return res.choices[0].message.content.trim();
}

module.exports = { askAI, askAssistant };
