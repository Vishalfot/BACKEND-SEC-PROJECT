const jwt=require("jsonwebtoken")
const authentication=async(req,res,next)=>{
    try{
        const token=req.cookies.token
        if(!token){
            return res.status(401).json({status:false,message:"Authentication failed"})
        }
        const payload=await jwt.verify(token,process.env.JWT_SECRET)
        req.user=payload;
        next()
    }catch(error){
        console.log(error)
    }
}
module.exports=authentication