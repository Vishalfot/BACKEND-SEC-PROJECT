// const express=require("express")
// const mongoose=require("mongoose")

// // import eventRoutes from "./routes/eventRoutes.js";

// const cookieparser=require("cookie-parser")
// const cors=require("cors")
// const dotenv =require("dotenv") 
// dotenv.config()
// const app=express()
// app.use(cors({
//     origin: "http://127.0.0.1:3000",
//     credentials: true
// }));
// app.use(cookieparser())
// app.use(express.json())
// app.use("/auth",eventRoutes)
// mongoose.connect(process.env.URI).then(()=>{
//     console.log("Connected to mongodb")
// })
// app.listen(process.env.PORT,()=>{
//     console.log("listening to port 2000")
// })

import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import eventRoutes from "./routes/Event.js";
import touristRoutes from "./routes/Touristplace.js"
import productRoutes from "./routes/Product.js"
import UserRouter from "./routes/user.cjs";
dotenv.config();
const app = express();

app.use(cors({
    origin: "http://127.0.0.1:3000",
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use("/event", eventRoutes);
app.use("/product",productRoutes);
app.use("/tourist",touristRoutes);
app.use("/auth",UserRouter);
mongoose.connect(process.env.URI).then(() => {
    console.log("Connected to MongoDB");
});

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`);
});
