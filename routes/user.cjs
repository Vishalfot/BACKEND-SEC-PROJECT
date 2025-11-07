const express=require("express")
const UserRouter=express.Router()
const Usermodel=require("../models/User.cjs")
const bcrypt=require("bcrypt")
const jwt=require("jsonwebtoken")
const authentication=require("../middleware/authentication.cjs")
UserRouter.post("/signup",async(req,res)=>{
    try {
        const {username,email,password,role}=req.body
    const user =await Usermodel.findOne({email})
    if(user){
        return res.json({error:"User already exist"})
    }
    const hashpass=await bcrypt.hash(password,10)
    const newuser=new Usermodel({username:username,email:email,password:hashpass,role:role})
    await newuser.save()
    res.status(201).json({status:true,message:"User created sucessfully"})
    } catch (error) {
        console.log(error);
        res.status(500).json({status:false,message:"Sign-up failed"})
    }
})
UserRouter.post("/login",async(req,res)=>{
    try {
        const {email,password}=req.body
    const user=await Usermodel.findOne({email})
    if(!user){
        return res.status(400).json({status:false,message:"User does not exist "})
    }
    const ismatch=await bcrypt.compare(password,user.password)
    if(!ismatch){
        return res.status(400).json({status:false,message:"Incorrect password"})
    }
    const token=jwt.sign({email:user.email},process.env.JWT_SECRET,{expiresIn:"4h"})
    res.cookie("token",token)
    res.status(200).json({status:true,message:"User logged in successfully",token,role:user.role})
    } catch (error) {
        console.log(error);
        res.status(500).json({status:false,message:"Log-in failed"})
    }
})
UserRouter.get("/logout",(req,res)=>{
    res.clearCookie("token")
    return res.json({status:true,message:"logged out"})
})
module.exports=UserRouter;