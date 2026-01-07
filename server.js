// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ------------------- Firebase Initialization -------------------
let serviceAccount;
try {
  serviceAccount = require("./serviceAccountKey.json");
} catch (err) {
  console.error("❌ Firebase serviceAccountKey.json nahi mili!");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
console.log("✅ Firebase initialize ho gaya");

// ------------------- Nodemailer Gmail Setup -------------------
if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  console.error("❌ GMAIL_USER ya GMAIL_PASS .env me nahi mili!");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // aapka Gmail
    pass: process.env.GMAIL_PASS, // Gmail App Password
  },
});

// ------------------- Helpers -------------------
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ------------------- Routes -------------------

// 1️⃣ Send OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, error: "Email daalo!" });

  console.log(`\n📧 OTP bhejne ki request: ${email}`);

  try {
    // Firebase me user check karo
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email.toLowerCase()).get();
    if (snapshot.empty) return res.json({ success: false, error: "User nahi mila" });
    console.log("✅ User Firebase me mil gaya");

    // OTP generate karo
    const otp = generateOtp();
    console.log(`🔑 OTP generate hua: ${otp}`);

    // OTP Firestore me save karo 5 min ke liye
    const otpRef = db.collection("otps").doc(email.toLowerCase());
    await otpRef.set({
      otp,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
    });
    console.log("✅ OTP Firestore me save ho gaya");

    // Gmail se OTP bhejo
    const mailOptions = {
      from: `"IBRAHIM OTP" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Aap ka OTP Code",
      html: `<p>Aap ka OTP code hai <b>${otp}</b>. Ye 5 minutes me expire ho jayega.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ OTP email Gmail se bhej diya");

    res.json({ success: true, message: "OTP successfully bhej diya" });
  } catch (err) {
    console.error("❌ OTP bhejne me error:", err);
    res.json({ success: false, error: "OTP bhejna fail ho gaya" });
  }
});

// 2️⃣ Verify OTP
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.json({ success: false, error: "Email aur OTP daalo" });

  console.log(`\n🔍 OTP verify kar rahe hain: ${email}`);

  try {
    const otpRef = db.collection("otps").doc(email.toLowerCase());
    const doc = await otpRef.get();
    if (!doc.exists) return res.json({ success: false, error: "OTP nahi mila" });

    const data = doc.data();
    const now = new Date();
    if (now > data.expiresAt.toDate()) {
      await otpRef.delete();
      return res.json({ success: false, error: "OTP expire ho gaya" });
    }

    if (data.otp !== otp) return res.json({ success: false, error: "OTP galat hai" });

    await otpRef.delete();
    console.log("✅ OTP verify ho gaya");
    res.json({ success: true, message: "OTP verify ho gaya" });
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    res.json({ success: false, error: "OTP verify fail ho gaya" });
  }
});

// 3️⃣ Reset Password
app.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ success: false, error: "Email aur password daalo" });

  console.log(`\n🔑 Reset password request: ${email}`);

  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email.toLowerCase()).get();
    if (snapshot.empty) return res.json({ success: false, error: "User nahi mila" });

    const userDoc = snapshot.docs[0];
    const userRef = db.collection("users").doc(userDoc.id);

    const hashedPassword = bcrypt.hashSync(password, 10);
    await userRef.update({ password: hashedPassword, accountStatus: "Active" });

    console.log("✅ Password reset ho gaya");
    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.json({ success: false, error: "Password reset fail ho gaya" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🚀 Server chal raha hai: http://localhost:${PORT}`));
