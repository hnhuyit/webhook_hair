import crypto from "crypto";

function hashData(data) {
  return crypto.createHash('sha256')
    .update(data.trim().toLowerCase())
    .digest('hex');
}

function normalizePhone(phone) {
  // Chuyển 0912345678 thành +84912345678
  return phone.replace(/^0/, '+84').replace(/\s+/g, '');
}

// module.exports = {
//   hashData,
//   normalizePhone
// };
export { hashData, normalizePhone };