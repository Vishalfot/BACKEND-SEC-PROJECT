// import dotenv from "dotenv"
// dotenv.config()
// import {v2 as cloudinary} from "cloudinary"

// import fs from "fs"

// cloudinary.config({ 
//         cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
//         api_key:process.env.CLOUDINARY_API_KEY,
//         api_secret: process.env.CLOUDINARY_API_SECRET 
//  });

//  const uploadonCloudinary=async(localFilePath,options)=>{
//     try {
//         if(!localFilePath) return null
//         //upload the file on cloudinary
//         const response=await cloudinary.uploader.upload(localFilePath,{
//             resource_type:"image",
//             ...options
//         })
//         fs.unlinkSync(localFilePath)
//         //file has been uploaded successfully
//         console.log("file is uploaded on cloudinary",response.url);
//         return response
//     } catch (error) {
//         fs.unlinkSync(localFilePath)//remove the locally saved temporary file as the upload operation got failed
//         console.error(error)
//         return null;
//     }
//  }
   
// export {uploadonCloudinary}

import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadonCloudinary = async (localFilePath, options = {}) => {
    try {

        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            ...options
        });

        // ✅ Clean up temp file after successful upload
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        console.log("Uploaded to Cloudinary:", response.secure_url);

        return response;

    } catch (error) {

        // ✅ Also clean up if upload fails, to avoid orphaned temp files
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        console.error("Cloudinary Upload Error:", error.message);
        return null;
    }
};

export { uploadonCloudinary };
