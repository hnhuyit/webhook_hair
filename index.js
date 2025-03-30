const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const axios = require('axios');
require('dotenv').config();

// const { replyZalo } = require("./zalo.js");
// const { askAI } = require("./ai.js");
const { handleAIReply } = require("./handlers/aiResponder");

const app = express();
app.use(express.static("public"));
// app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "1234567890";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
const PAGE_ID = process.env.PAGE_ID || "543096242213723";


// Middleware để lấy raw body
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString("utf8"); // raw body để verify chữ ký
  }
}));

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

//zalo
app.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const timestamp = req.headers["x-zalopayload-timestamp"];
    const signature = req.headers["x-zevent-signature"];

     // 👉 Log headers để kiểm tra khi Zalo gửi test
     console.log("---- Nhận request từ Zalo ----");
    //  console.log("Headers:", req.headers);
    //  console.log("Raw Body:", rawBody);
    //  console.log("Parsed Body:", req.body);

    // if (!signature || !rawBody) {
    //   // console.error("❌ Thiếu header hoặc raw body");
    //   console.warn("❌ Thiếu thông tin xác thực, trả về 200 để test webhook Zalo");
    //   return res.status(200).send("Zalo webhook test accepted");
    // }

    // // ✅ Nếu có chữ ký nhưng KHÔNG có timestamp → bỏ timestamp khỏi xác thực
    // const rawSignature = signature.replace("mac=", "").trim();
    // const components = APP_ID + rawBody + (timestamp || "") + APP_SECRET;

    // let expectedMac = "";
    // if (timestamp) {
    //   expectedMac = crypto.createHash("sha256")
    //     .update(APP_ID + rawBody + timestamp + APP_SECRET)
    //     .digest("hex");
    // } else {
    //   expectedMac = crypto.createHash("sha256")
    //     .update(components)
    //     .digest("hex");
    // }

    // console.log("📦 Expect:", expectedMac);
    // console.log("📦 From Zalo:", rawSignature);
    
    // if (rawSignature !== expectedMac) {
    //   console.warn("❌ Sai chữ ký!");
    //   return res.status(401).send("Invalid signature");
    // }

    // if (signature !== expectedMac) {
    //   // console.error("❌ Sai chữ ký!");
    //   console.warn("❌ Chữ ký sai – từ chối request");
    //   return res.status(401).send("Invalid signature");
    // }


    const { event_name, sender, message } = req.body;

    if (event_name === "user_send_text") {
      const userId = sender.id;
      const userMessage = message.text;

      const reply = `Bạn vừa gửi: "${userMessage}"`; // test cứng
      // Gọi hàm async để xử lý AI
      await handleAIReply(userId, userMessage);
    }

    // ✅ Thành công
    console.log("✅ Webhook nhận được:", req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 Lỗi webhook:", err);
    res.sendStatus(500);
  }
});


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
