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

async function getRecentThreadHistory(threadId, days = 7) {
  const res = await openai.beta.threads.messages.list(threadId);
  const now = Date.now();
  const sevenDaysAgo = now - days * 24 * 60 * 60 * 1000;

  const recentMessages = res.data
    .filter(msg =>
      (msg.role === 'user' || msg.role === 'assistant') &&
      msg.created_at * 1000 >= sevenDaysAgo
    )
    .sort((a, b) => a.created_at - b.created_at)
    .map(msg => ({
      role: msg.role,
      content: msg.content?.[0]?.text?.value || ""
    }));

  return recentMessages;
}

//with Assistant :askAssistantWithRecentContext
async function askAssistant(message, prompt, userId) {
  const threadId = await getOrCreateThread(userId); // bạn tự mapping user ↔ thread

  const recentHistory = await getRecentThreadHistory(threadId);

  const messages = [
    {
      role: "system",
      content: prompt
    },
    ...recentHistory,
    { role: "user", content: message }
  ];

  const res = await openai.chat.completions.create({
    model: "gpt-4-mini", // hoặc gpt-4o nếu bạn đã bật
    messages
  });

  const reply = res.choices[0].message.content.trim();

  // Ghi lại message mới vào thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message
  });

  await openai.beta.threads.messages.create(threadId, {
    role: "assistant",
    content: reply
  });

  return reply;
}

// //with Assistant
// async function askAssistantdraft(message, userId) {
//   // Lấy hoặc tạo thread cho user
//   const threadId = await getOrCreateThread(userId);

//   // Thêm message của user vào thread
//   await openai.beta.threads.messages.create(threadId, {
//     role: "user",
//     content: message
//   });

//   // Chạy assistant trên thread
//   const run = await openai.beta.threads.runs.create(threadId, {
//     assistant_id: process.env.ASSISTANT_ID
//   });

//   // Chờ assistant xử lý xong
//   let status = "queued";
//   while (status !== "completed") {
//     const runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
//     status = runStatus.status;
//     if (status === "failed") throw new Error("Assistant failed");
//     await new Promise((res) => setTimeout(res, 5000));
//   }

//   // Lấy trả lời cuối cùng
//   const messages = await openai.beta.threads.messages.list(threadId);
  
//   // Chỉ lấy message mới nhất từ Assistant
//   const latest = messages.data
//   .filter((msg) => msg.role === "assistant")
//   .sort((a, b) => b.created_at - a.created_at)[0];

//   const reply = latest?.content?.[0]?.text?.value;

//   return reply.trim();
// }

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
