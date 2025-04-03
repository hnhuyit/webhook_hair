require("dotenv").config();
const OpenAI = require("openai");
const Airtable = require("airtable");
// const prompt = require("./config/gptService");

// const prompt = fs.readFileSync("./config/systemPrompt.txt", "utf8"); //process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.";
// ai.js (hỗ trợ OpenAI SDK v4+)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Config Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base("apptmh0D4kfxxCTn1");
const TABLE_NAME = "Customers";

// lỗi server không phải ở VN
async function getZaloUserProfile(uid, accessToken) {
  try {
    const url = `https://openapi.zalo.me/v2.0/oa/getprofile?user_id=${uid}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "access_token": accessToken,
      },
    });

    const data = await res.json();

    if (data.error === 0) {
      console.log("✅ Thông tin người dùng Zalo:", data.data);
      return data.data; // { display_name, avatar, gender, ... }
    } else {
      console.warn("⚠️ Không lấy được profile Zalo:", data.message);
      return null;
    }
  } catch (error) {
    console.error("❌ Lỗi khi gọi Zalo getprofile:", error);
    return null;
  }
}

// async function updateLastInteraction(userId) {
//   try {
//     const records = await base(TABLE_NAME)
//       .select({
//         filterByFormula: `{ZaloUID} = '${userId}'`,
//         maxRecords: 1,
//       })
//       .firstPage();

//     if (records.length === 0) {
//       console.warn("⚠️ Không tìm thấy user để update LastInteraction:", userId);
//       return;
//     }

//     await base(TABLE_NAME).update([
//       {
//         id: records[0].id,
//         fields: {
//           LastInteraction: new Date().toISOString(),
//         },
//       },
//     ]);

//     console.log("✅ Cập nhật LastInteraction cho:", userId);
//   } catch (err) {
//     console.error("❌ Lỗi updateLastInteraction:", err);
//   }
// }

// async function getOrCreateThread(userId) {
//   try {
//     // 1. Kiểm tra xem userId đã có trong bảng Airtable chưa
//     const records = await base(TABLE_NAME)
//       .select({
//         filterByFormula: `{ZaloUID} = '${userId}'`,
//         maxRecords: 1,
//       })
//       .firstPage();

//     if (records.length > 0) {
//       const threadId = records[0].fields.ThreadID;
//       console.log("🔁 Đã tìm thấy thread:", threadId);
//       return threadId;
//     }

//     // 2. Nếu chưa có → tạo thread mới trên OpenAI
//     const thread = await openai.beta.threads.create();

//     // 3. Lưu vào Airtable
//     await base(TABLE_NAME).create([
//       {
//         fields: {
//           ZaloUID: userId,
//           ThreadID: thread.id,
//           LastUpdated: new Date().toISOString(),
//         },
//       },
//     ]);

//     console.log("✅ Tạo thread mới & lưu vào Airtable:", thread.id);
//     return thread.id;
//   } catch (err) {
//     console.error("🔥 Lỗi getOrCreateThread:", err);
//     throw err;
//   }
// }

// => Dùng Airtblae để lưu Thread
// const userThreads = JSON.parse(fs.readFileSync('userThreads.json', 'utf-8'));
// let userThreads = {};
// const raw = fs.readFileSync('userThreads.json', 'utf-8');
// if (raw.trim()) {
//   userThreads = JSON.parse(raw);
// }
// // 🧠 Lấy hoặc tạo thread_id cho user
// async function getOrCreateThread(userId) {
//   if (userThreads[userId]) return userThreads[userId];

//   const thread = await openai.beta.threads.create();
//   userThreads[userId] = thread.id;
//   fs.writeFileSync('userThreads.json', JSON.stringify(userThreads, null, 2));
//   return thread.id;
// }

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

async function getOrCreateThread(userId) {
  try {
    const records = await base(TABLE_NAME)
      .select({ filterByFormula: `{ZaloUID} = '${userId}'`, maxRecords: 1 })
      .firstPage();

    // const profile = await getZaloUserProfile(userId, process.env.OA_ACCESS_TOKEN);
    // console.log("🔁 profile", profile);
    // const displayName = profile?.display_name || "Zalo User";
    // const avatar = profile?.avatar || "";
    // const gender = profile?.gender || ""; // 1 = nam, 2 = nữ
    // const location = profile?.shared_info?.location || "";
    // const birthday = profile?.shared_info?.birthday || "";

    if (records.length > 0) {
      const threadId = records[0].fields.ThreadID;

      // // ✅ Nếu đã có thì cập nhật lại LastInteraction
      // await base(TABLE_NAME).update([
      //   {
      //     id: records[0].id,
      //     fields: {
      //       LastInteraction: new Date().toISOString(), // chuẩn ISO, Airtable hiểu
      //       // Name: displayName,
      //       // Avatar: avatar,
      //       // Gender: gender,
      //       // Location: location,
      //       // Birthday: birthday,
      //     },
      //   },
      // ]);

      console.log("🔁 Đã tìm thấy thread:", threadId);
      return threadId;
    }
    const thread = await openai.beta.threads.create();

    // 3. Lưu vào Airtable
    await base(TABLE_NAME).create([
      {
        fields: {
          ZaloUID: userId,
          ThreadID: thread.id,
          LastInteraction: new Date().toISOString(),
          // Name: displayName,
          // Avatar: avatar,
          // Gender: gender,
          // Location: location,
          // Birthday: birthday,
        },
      },
    ]);

    console.log("✅ Tạo thread mới & lưu vào Airtable:", thread.id);
    return thread.id;
  } catch (err) {
    console.error("🔥 Lỗi getOrCreateThread:", err);
    throw err;
  }
}

//with Assistant :askAssistantWithRecentContext
async function askAssistant(message, userId) {
  const threadId = await getOrCreateThread(userId); // bạn tự mapping user ↔ thread
  // Gửi message người dùng vào thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });

  // Gọi Assistant (dùng assistant_id bạn tạo sẵn)
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.ASSISTANT_ID,
    memory: [], // Loại bỏ bộ nhớ dài hạn
  });

  // Polling để đợi Assistant trả lời
  let status = "queued";
  while (status !== "completed") {
    const result = await openai.beta.threads.runs.retrieve(threadId, run.id);
    status = result.status;
    if (status === "failed") throw new Error("Assistant failed");

    if (status === "requires_action") {
      console.warn("⚠️ Assistant yêu cầu gọi function – chưa xử lý logic đó.");
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  // Lấy message cuối từ assistant
  const messages = await openai.beta.threads.messages.list(threadId);
  const latest = messages.data
    .filter((m) => m.run_id === run.id && m.role === "assistant")
    .sort((a, b) => b.created_at - a.created_at)[0];

  return latest?.content?.[0]?.text?.value?.trim() || "[Không có phản hồi]";
}

//with Assistant
async function askAssistantdraft(message, userId) {
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
    await new Promise((res) => setTimeout(res, 5000));
  }

  // Lấy trả lời cuối cùng
  const messages = await openai.beta.threads.messages.list(threadId);
  
  // Chỉ lấy message mới nhất từ Assistant
  const latest = messages.data
  .filter((msg) => msg.role === "assistant")
  .sort((a, b) => b.created_at - a.created_at)[0];

  const reply = latest?.content?.[0]?.text?.value;

  return reply.trim();
}

const tools = [{
  "type": "function",
  "function": {
      "name": "get_weather",
      "description": "Get current temperature for a given location.",
      "parameters": {
          "type": "object",
          "properties": {
              "location": {
                  "type": "string",
                  "description": "City and country e.g. Bogotá, Colombia"
              }
          },
          "required": [
              "location"
          ],
          "additionalProperties": false
      },
      "strict": true
  }
}];

//with AI
async function askAI(message, prompt, history) {

  const cleanHistory = Array.isArray(history)
    ? history.filter(msg => msg?.role && typeof msg.content === "string")
    : [];

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini", // hoặc gpt-4 nếu bạn dùng
    // web_search_options: {}, Built-in tools: Use built-in tools like web search and file search to extend the model's capabilities.
    messages: [
      { role: "system", content: prompt },
      ...cleanHistory,
      { role: "user", content: 
          [
            // {
            //     type: "file", // File inputs: Learn how to use PDF files as inputs to the OpenAI API.
            //     file: {
            //         file_id: "file-6CXFs4ZD9tjfduS5xNzdTV",
            //     }
            // },
            {
                type: "text",
                text: message,
            },
        ],

      }
    ],
    //stream: true, //Streaming API responses : Learn how to stream model responses from the OpenAI API using server-sent events.
    // tools,         Function Calling: Enable models to fetch data and take actions.
    // store: true,   
  });
  return res.choices[0].message.content.trim();
}

module.exports = { askAI, askAssistant };
