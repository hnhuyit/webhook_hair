// const express = require("express");
// const bodyParser = require("body-parser");
// const crypto = require("crypto");
// const axios = require('axios');
// const Airtable = require("airtable");
// require('dotenv').config();

import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import axios from "axios";
import Airtable from "airtable";
import dotenv from "dotenv";
import cron from "node-cron";

// Load biến môi trường
dotenv.config();

// const { handleAIReply, handleAssistantReply } = require("./handlers/aiResponder");
// const { replyZalo } = require("./zalo");

import { handleAIReply } from "./handlers/aiResponder.js";
import { replyZalo } from "./zalo.js"; // hoặc "./zalo.js" nếu file đó là file riêng
import { hashData, normalizePhone} from "./hashUtil.js";

const app = express();
app.use(express.static("public"));

// Config Airtable
const TABLE_NAME = "Customers";
const ChatHistory = "ChatHistory";
const BASE_ID = "apptmh0D4kfxxCTn1";
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(BASE_ID);

// Middleware để lấy raw body
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString("utf8"); // raw body để verify chữ ký
  }
}));

app.use((req, res, next) => {
  if (req.headers["x-api-key"] !== "your-secret-token") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// => Dùng để xác thực webhook
// const APP_ID = process.env.APP_ID;
// const APP_SECRET = process.env.APP_SECRET;
// const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "1234567890";
// const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
// const PAGE_ID = process.env.PAGE_ID || "543096242213723";


// const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "";
// const SYSTEM_PROMPT = require("./config/gptService");
// const prompt_tuktuk = require("./config/gptServiceTuktuk");
// const prompt_anna = require("./config/gptServiceAnna");

// const token = process.env.OA_ACCESS_TOKEN;
// const token_tuktuk = process.env.OA_TUKTUK;
// const token_anna = process.env.OA_ANNA;

const unsupportedTypes = [
  "user_send_image",
  "user_send_video",
  "user_send_audio",
  "user_send_file",
  "user_send_sticker",
  "user_send_location",
  "user_send_business_card"
];



const table = "Raw";
async function getUnhashedUsers() {
  const records = [];
  await base(table).select({
    filterByFormula: "OR({Hashed} = '', {Hashed} = BLANK())",
    maxRecords: 100
  }).eachPage((page, fetchNextPage) => {
    records.push(...page);
    fetchNextPage();
  });
  return records;
}

async function updateHashedUser(recordId, hashedPhone) {
  return base(table).update(recordId, {
    // "Email_Hashed": hashedEmail,
    "Phone_Hashed": hashedPhone,
    "Hashed": true
  });
}

async function fetchConfigFromAirtable() {
  const tableName = 'Meta';
  const records = await base(tableName).select().all();

  const config = {};
  for (const record of records) {
    const name = record.fields.name;
    const value = record.fields.key;
    if (name && typeof value !== "undefined") {
      config[name] = value;
    }  }

  return config;
}

let cachedToken = "wfToDFYLfdZhbNCxyfQXUEEGUJNjaEyFh_nKGSoVWbFLrHjvXzARSDEa6KgUz8q5ZPCV6C-Kh0IPmJbBmQUJ2PVXCoZEXh0fm_1W8goRkJVwdYfqk9IENld8A4Iig_fqmyzzLQJ8q4Z5gm17ilkMTwA90tNbwgSZdxeHRDp2X6wqWZLOtVBY4x6HCm_V-Aj5ovedNDgOimhFmM8ceC7XFD-PGHMexEu0vPayLl3Og1Ynspe1uww42gJyFGEtzfL9u9qYSvMQzbh_xazEkPNNPShWUL6CdyrOuCvEGOogmLJOndeOgQRs2zt6U2AEawyRo_8z8Q2kcMBnoKfJWuZz4FBtL3-PbuqW_SO17B76r0Afh60Lkw_R6_dAVGo3bTaT-kS9FkFdZG2leLaQxAJoCVtS8IE_lOaF83FXU_wAgta";

export async function refreshOAToken() {
  const config = await fetchConfigFromAirtable();
  const newToken = config.OA_ACCESS_TOKEN;

  if (newToken && newToken !== cachedToken) {
    cachedToken = newToken;
    console.log(`[TOKEN] OA Token refreshed at ${new Date().toISOString()}`);
  } else {
    console.log(`[TOKEN] OA Token unchanged`);
  }

  return cachedToken;
}

export function getOAToken() {
  return cachedToken;
}

cron.schedule("30 1 * * *", async () => {
  console.log("[CRON] 1:30AM - Refreshing OA token...");
  await refreshOAToken();
});

//Ghi nhận lead từ conversation kèm info để update Customer

// Add support for GET requests to our webhook
app.get("/messaging-webhook", (req, res) => {
  
  // Parse the query params
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
  
    // Check if a token and mode is in the query string of the request
    if (mode && token) {
      // Check the mode and token sent is correct
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        // Respond with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        // Respond with '403 Forbidden' if verify tokens do not match
        res.status(403).send("Forbidden – Token mismatch");
      }
    }
});

// HANDLE POST EVENTS
app.post('/messaging-webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
      body.entry.forEach(entry => {
          const webhook_event = entry.messaging[0];
          console.log("New Event:", webhook_event, PAGE_ACCESS_TOKEN);

          const sender_psid = webhook_event.sender.id;
          if (webhook_event.message) {
            handleMessage(sender_psid, webhook_event.message);
          } else if (webhook_event.postback) {
            handlePostback(sender_psid, webhook_event.postback);
          }
      });
      res.status(200).send('EVENT_RECEIVED');
  } else {
      res.sendStatus(404);
  }
});

function handlePostback(sender_psid, postback) {
  const payload = postback.payload;
  console.log("🧠 Postback từ người dùng:", payload);

  let response;

  if (payload === 'GET_STARTED') {
    response = { text: "Chào mừng bạn đến với LUXX! 💅 Hãy nhắn 'menu' để xem dịch vụ." };
  } else if (payload === 'VIEW_SERVICES') {
    response = { text: "Dưới đây là các dịch vụ của LUXX Spa...\n🦶 Pedicure, ✋ Manicure, 💅 Nail Art, v.v..." };
  } else {
    response = { text: `Bạn vừa bấm nút có payload: "${payload}"` };
  }

  callSendAPI(sender_psid, response);
}

function handleMessage(sender_psid, received_message) {
  console.log("Message from", sender_psid, ":", received_message.text);
  // Ở đây bạn có thể gọi API gửi tin nhắn phản hồi
  let response;

  if (received_message.text) {
    // Xử lý text bình thường
    response = {
      "text": `Bạn vừa nói: "${received_message.text}". LUXX cảm ơn bạn đã nhắn tin! 🌸`
    };
  } else {
    // Trường hợp không phải tin nhắn text (ảnh, audio,...)
    response = {
      "text": "LUXX hiện tại chỉ tiếp nhận tin nhắn dạng văn bản. Hẹn gặp bạn sau nhé! 💅"
    };
  }

  // Gửi phản hồi
  callSendAPI(sender_psid, response);
}

async function callSendAPI(sender_psid, response) {
  const request_body = {
    recipient: {
      id: sender_psid
    },
    messaging_type: "RESPONSE",
    message: response
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      request_body
    );
    console.log("✅ Tin nhắn đã gửi thành công!", res.data);
  } catch (err) {
    console.error(`❌ Gửi tin nhắn cho ${sender_psid} thất bại:`, err.response ? err.response.data : err.message);
  }
}

async function updateLastInteractionOnlyIfNewDay(userId, event_name) {
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `{ZaloUID} = '${userId}'`,
        maxRecords: 1,
      })
      .firstPage();

    const todayISOString = new Date().toISOString();

    if (records.length === 0) {
      console.warn("⚠️ Không tìm thấy user → tiến hành tạo mới:", userId);

      // ✅ Tạo mới nếu chưa có user
      await base(TABLE_NAME).create([
        {
          fields: {
            ZaloUID: userId,
            // ThreadID: threadId,
            event_name: event_name,
            LastInteraction: todayISOString,
            // Có thể thêm các trường khác như Name, Avatar, v.v. nếu có
          },
        },
      ]);

      console.log("✅ Đã tạo mới user trong Airtable:", userId);
      return;
    }

    const record = records[0];
    const oldDate = record.fields.LastInteraction;
    const today = todayISOString.slice(0, 10); // yyyy-mm-dd

    if (oldDate) {
      const lastDate = new Date(oldDate).toISOString().slice(0, 10);
      if (lastDate === today) {
        console.log("🟡 Cùng ngày, không cần update LastInteraction:", userId);
        return; // ❌ Không update
      }
    }

    // ✅ Khác ngày → update LastInteraction
    await base(TABLE_NAME).update([
      {
        id: record.id,
        fields: {
          LastInteraction: todayISOString,
          last_event: event_name,
        },
      },
    ]);

    console.log("✅ Đã update LastInteraction mới cho:", userId);
  } catch (err) {
    console.error("🔥 Lỗi khi xử lý LastInteraction:", err);
  }
}

async function saveMessage({ userId, role, message }) {
  await base(ChatHistory).create({
    UserID: userId,
    Role: role,
    Message: message,
    Timestamp: new Date().toISOString()
  });
}
async function getRecentMessages(userId, limit = 100) {
  const records = await base(ChatHistory).select({
    filterByFormula: `{UserID} = "${userId}"`,
    sort: [{ field: "Timestamp", direction: "desc" }],
    maxRecords: limit
  }).firstPage();

  return records.map(r => ({
    role: r.get("Role"),
    content: r.get("Message")
  })).reverse(); // Đảo ngược lại thứ tự cho đúng lịch sử
}

function normalizeVietnamesePhone(phone) {
  if (!phone || typeof phone !== "string") return "";

  // Loại bỏ mọi ký tự không phải số
  let digits = phone.replace(/[^\d]/g, "").trim();

  // Map các đầu số cũ sang mới
  const oldToNewPrefixes = {
    "0162": "032", "0163": "033", "0164": "034", "0165": "035", "0166": "036",
    "0167": "037", "0168": "038", "0169": "039",
    "0120": "070", "0121": "079", "0122": "077", "0123": "083", "0124": "084",
    "0125": "085", "0126": "076", "0127": "081", "0128": "078",
    "0186": "056", "0188": "058",
    "0199": "059"
  };

  // Nếu bắt đầu bằng 0 và là 11 số → kiểm tra đầu số cũ
  if (digits.startsWith("0") && digits.length === 11) {
    let prefix = digits.substring(0, 4);
    let newPrefix = oldToNewPrefixes[prefix];
    if (newPrefix) {
      return "+84" + newPrefix + digits.slice(4); // bỏ prefix cũ, thay bằng mới
    }
  }

  // Nếu bắt đầu bằng 0 và đủ 10 số → chuyển thành +84
  if (digits.startsWith("0") && digits.length === 10) {
    return "+84" + digits.slice(1);
  }

  // Nếu bắt đầu bằng 84 → chuyển thành +84
  if (digits.startsWith("84") && digits.length === 11) {
    return "+84" + digits.slice(2);
  }

  // Nếu bắt đầu bằng +84 và đúng định dạng → giữ nguyên
  if (phone.startsWith("+84") && digits.length === 11) {
    return "+84" + digits.slice(2);
  }

  // Không hợp lệ
  return "";
}


app.post('/hash-users-daily', async (req, res) => {
  const { phone } = req.body;

  const formattedPhone = normalizeVietnamesePhone(phone);

  if (!formattedPhone) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  const hash = crypto.createHash("sha256").update(formattedPhone).digest("hex");

  res.json({ hashed_phone: hash, formatted_phone: formattedPhone });
});

//zalo: Hoang Hưng Thịnh
app.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.rawBody;
     // 👉 Log headers để kiểm tra khi Zalo gửi test
    //  console.log("---- Nhận request từ Zalo ----", rawBody);

    const { event_name, sender, message } = req.body;
    const userId = sender.id;
    const userMessage = message.text;

    const config = await fetchConfigFromAirtable();
    const SYSTEM_PROMPT = config.SYSTEM_PROMPT;
    const token = getOAToken(); // Dùng token được cache từ 1h30AM

    await saveMessage({ userId, role: "user", message: userMessage });
    
    const history = await getRecentMessages(userId);
    // console.log("history", history)
    
    await updateLastInteractionOnlyIfNewDay(userId, event_name);
    if (event_name === "user_send_text") {
      console.log(`Bạn vừa gửi: "${userMessage}"`);

      const aiReply = await handleAIReply(userId, userMessage, SYSTEM_PROMPT, history, token);
      // await handleAssistantReply(userId, userMessage, token);
      
      await saveMessage({ userId, role: "assistant", message: aiReply });
    } else if (unsupportedTypes.includes(event_name)) {
      await replyZalo(userId, `❗ Trợ lý AI hiện tại **chưa hỗ trợ xử lý loại nội dung này**.\n\n📌 Vui lòng gửi tin nhắn văn bản để được phản hồi chính xác nhé.`, token);
    } else {
      await replyZalo(userId, `Chào bạn, rất vui được kết nối! Mình có thể hỗ trợ gì cho kế hoạch áp dụng AI và Automation cho bạn không?`, token);
      console.log("❓ Loại event chưa xử lý:", event_name);
    }

    // ✅ Thành công
    console.log("✅ Webhook nhận được:", event_name, req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 Lỗi webhook:", err);
    res.sendStatus(500);
  }
});


// //zalo: Tuktuk
// app.post("/webhook-tuktuk", async (req, res) => {
//   try {
//     const rawBody = req.rawBody;
//     const timestamp = req.headers["x-zalopayload-timestamp"];
//     const signature = req.headers["x-zevent-signature"];

//      // 👉 Log headers để kiểm tra khi Zalo gửi test
//      console.log("---- Nhận request từ Zalo ----");
//      console.log("Headers:", req.headers);
//      console.log("Raw Body:", rawBody);
//      console.log("Parsed Body:", req.body);

//     // if (!signature || !rawBody) {
//     //   // console.error("❌ Thiếu header hoặc raw body");
//     //   console.warn("❌ Thiếu thông tin xác thực, trả về 200 để test webhook Zalo");
//     //   return res.status(200).send("Zalo webhook test accepted");
//     // }

//     // // ✅ Nếu có chữ ký nhưng KHÔNG có timestamp → bỏ timestamp khỏi xác thực
//     // const rawSignature = signature.replace("mac=", "").trim();
//     // const components = APP_ID + rawBody + (timestamp || "") + APP_SECRET;

//     // let expectedMac = "";
//     // if (timestamp) {
//     //   expectedMac = crypto.createHash("sha256")
//     //     .update(APP_ID + rawBody + timestamp + APP_SECRET)
//     //     .digest("hex");
//     // } else {
//     //   expectedMac = crypto.createHash("sha256")
//     //     .update(components)
//     //     .digest("hex");
//     // }

//     // console.log("📦 Expect:", expectedMac);
//     // console.log("📦 From Zalo:", rawSignature);
    
//     // if (rawSignature !== expectedMac) {
//     //   console.warn("❌ Sai chữ ký!");
//     //   return res.status(401).send("Invalid signature");
//     // }

//     // if (signature !== expectedMac) {
//     //   // console.error("❌ Sai chữ ký!");
//     //   console.warn("❌ Chữ ký sai – từ chối request");
//     //   return res.status(401).send("Invalid signature");
//     // }


//     const { event_name, sender, message } = req.body;

//     if (event_name === "user_send_text") {
//       const userId = sender.id;
//       const userMessage = message.text;

//       const reply = `Bạn vừa gửi: "${userMessage}"`; // test cứng
//       // Gọi hàm async để xử lý AI
//       await handleAIReply(userId, userMessage, "Bạn là trợ lý OA.", token_tuktuk);
//     }

//     // ✅ Thành công
//     console.log("✅ Webhook nhận được:", req.body);
//     res.sendStatus(200);
//   } catch (err) {
//     console.error("🔥 Lỗi webhook:", err);
//     res.sendStatus(500);
//   }
// });


// //zalo: Tuktuk
// app.post("/webhook-anna", async (req, res) => {
//   try {
//     const rawBody = req.rawBody;
//     const timestamp = req.headers["x-zalopayload-timestamp"];
//     const signature = req.headers["x-zevent-signature"];

//      // 👉 Log headers để kiểm tra khi Zalo gửi test
//      console.log("---- Nhận request từ Zalo ----");
//      console.log("Headers:", req.headers);
//      console.log("Raw Body:", rawBody);
//      console.log("Parsed Body:", req.body);

//     // if (!signature || !rawBody) {
//     //   // console.error("❌ Thiếu header hoặc raw body");
//     //   console.warn("❌ Thiếu thông tin xác thực, trả về 200 để test webhook Zalo");
//     //   return res.status(200).send("Zalo webhook test accepted");
//     // }

//     // // ✅ Nếu có chữ ký nhưng KHÔNG có timestamp → bỏ timestamp khỏi xác thực
//     // const rawSignature = signature.replace("mac=", "").trim();
//     // const components = APP_ID + rawBody + (timestamp || "") + APP_SECRET;

//     // let expectedMac = "";
//     // if (timestamp) {
//     //   expectedMac = crypto.createHash("sha256")
//     //     .update(APP_ID + rawBody + timestamp + APP_SECRET)
//     //     .digest("hex");
//     // } else {
//     //   expectedMac = crypto.createHash("sha256")
//     //     .update(components)
//     //     .digest("hex");
//     // }

//     // console.log("📦 Expect:", expectedMac);
//     // console.log("📦 From Zalo:", rawSignature);
    
//     // if (rawSignature !== expectedMac) {
//     //   console.warn("❌ Sai chữ ký!");
//     //   return res.status(401).send("Invalid signature");
//     // }

//     // if (signature !== expectedMac) {
//     //   // console.error("❌ Sai chữ ký!");
//     //   console.warn("❌ Chữ ký sai – từ chối request");
//     //   return res.status(401).send("Invalid signature");
//     // }


//     const { event_name, sender, message } = req.body;

//     if (event_name === "user_send_text") {
//       const userId = sender.id;
//       const userMessage = message.text;

//       const reply = `Bạn vừa gửi: "${userMessage}"`; // test cứng
//       // Gọi hàm async để xử lý AI
//       await handleAIReply(userId, userMessage, "Bạn là trợ lý OA.", token_anna);
//     }

//     // ✅ Thành công
//     console.log("✅ Webhook nhận được:", req.body);
//     res.sendStatus(200);
//   } catch (err) {
//     console.error("🔥 Lỗi webhook:", err);
//     res.sendStatus(500);
//   }
// });

//test get
app.get("/webhook", (req, res) => {
  res.send("This endpoint only accepts POST requests.");
});
//test get
app.get("/", (req, res) => {
  res.send("This is homepage.");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
