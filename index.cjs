const express=require("express")
const mongoose=require("mongoose")
const UserRouter=require("./routes/user.cjs")
const cookieparser=require("cookie-parser")
const cors=require("cors")
const dotenv =require("dotenv") 
dotenv.config()
const app=express()
app.use(cors({
    origin: "http://127.0.0.1:3000",
    credentials: true
}));
app.use(cookieparser())
app.use(express.json())
app.use("/auth",UserRouter)
mongoose.connect(process.env.URI).then(()=>{
    console.log("Connected to mongodb")
})
app.listen(process.env.PORT,()=>{
    console.log("listening to port 2000")
})