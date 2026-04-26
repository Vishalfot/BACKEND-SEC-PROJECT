import express from "express";
import Usermodel from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authentication from "../middleware/authentication.js";

const UserRouter = express.Router();

// --- SIGN UP ---
UserRouter.post("/signup", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // 1. Check if user exists
    const userExists = await Usermodel.findOne({ email });
    if (userExists) return res.status(400).json({ error: "User already exists" });

    // 2. Hash Password
    const hashpass = await bcrypt.hash(password, 10);

    // 3. Create New User with Welcome Coins
    const newuser = new Usermodel({
      username,
      email,
      password: hashpass,
      role,
      coins: 100 // ✅ Direct assignment of Welcome Coins (e.g., ₹10 value)
    });

    await newuser.save();

    res.status(201).json({
      status: true,
      message: "Account created successfully! 100 Welcome Coins added to your wallet."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Sign-up failed" });
  }
});
// --- LOGIN ---
UserRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Usermodel.findOne({ email });

    if (!user) return res.status(400).json({ status: false, message: "User does not exist" });

    const ismatch = await bcrypt.compare(password, user.password);
    if (!ismatch) return res.status(400).json({ status: false, message: "Incorrect password" });

    const token = jwt.sign(
      { email: user.email, userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
    });

    res.status(200).json({
      status: true,
      message: "Logged in successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        coins: user.coins, // ✅ Frontend can now show coins in Navbar
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Log-in failed" });
  }
});

// --- GET ME (Verification Route) ---
// Useful for the frontend to check if the session is still valid
UserRouter.get("/me", authentication, async (req, res) => {
  try {
    const user = await Usermodel.findById(req.user.userId).select("-password");
    res.json({ status: true, user });
  } catch (error) {
    res.status(500).json({ status: false });
  }
});

UserRouter.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ status: true, message: "Logged out" });
});

export default UserRouter;