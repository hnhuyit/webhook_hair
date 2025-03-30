const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

// const { replyZalo } = require("./zalo.js");
// const { askAI } = require("./ai.js");
const { handleAIReply } = require("./handlers/aiResponder");

const app = express();
app.use(express.static("public"));
// app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = "1234567890"; // bạn tự định nghĩa

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
        res.sendStatus(403);
      }
    }
});

// HANDLE POST EVENTS
app.post('/webhook-meta', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
      body.entry.forEach(entry => {
          const webhook_event = entry.messaging[0];
          console.log("New Event:", webhook_event);

          const sender_psid = webhook_event.sender.id;
          if (webhook_event.message) {
              handleMessage(sender_psid, webhook_event.message);
          }
      });
      res.status(200).send('EVENT_RECEIVED');
  } else {
      res.sendStatus(404);
  }
});

function handleMessage(sender_psid, message) {
  console.log("Message from", sender_psid, ":", message.text);
  // Ở đây bạn có thể gọi API gửi tin nhắn phản hồi
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
