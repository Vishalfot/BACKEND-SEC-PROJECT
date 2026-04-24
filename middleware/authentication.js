// const jwt=require("jsonwebtoken")
// const authentication=async(req,res,next)=>{
//     try{
        
//         let token=req.cookies.token;
//         if (!token && req.headers.authorization) {
//             token = req.headers.authorization.split(" ")[1];
//         }
//         if(!token){
//             return res.status(401).json({status:false,message:"Authentication failed"})
//         }
//         console.log("--------------------------------");
//         console.log("Auth Middleware Triggered");
//         console.log("Cookies Received:", req.cookies.token); 
//         console.log("--------------------------------");
//         const payload= jwt.verify(token,process.env.JWT_SECRET)
//         req.user=payload;
//         next()
//     }catch(error){
//         console.log(error)
//         return res.status(401).json({status:false,message:"Authentication failed , please try later"})
//     }
// }
// module.exports=authentication

import jwt from "jsonwebtoken";

const authentication= async (req, res, next) => {
  try {
    console.log("--------------------------------");
    console.log("Auth Middleware Triggered");
    console.log("Cookies:", req.cookies);
    console.log("Auth Header:", req.headers.authorization);
    console.log("--------------------------------");

    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Authentication failed"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload;

    next();

  } catch (error) {
    console.log(error);

    return res.status(401).json({
      status: false,
      message: "Authentication failed, please try later"
    });
  }
};
export default authentication;
