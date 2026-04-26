import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["Tourist", "Local", "Shopper", "admin"],
        default: "Tourist"
    },
    // ✅ NEW: For the Loyalty System
    coins: {
        type: Number,
        default: 100 // Welcome gift of 10 coins
    },
    // ✅ NEW: For visual profile display
    avatar: {
        type: String,
        default: ""
    }
}, { timestamps: true });

const Usermodel = mongoose.model("User", UserSchema);
export default Usermodel;