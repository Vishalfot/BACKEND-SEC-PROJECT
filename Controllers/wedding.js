// import  Weddingplace  from "../models/weddings.js";
// import {uploadonCloudinary} from "../utils/cloudnary.js"

// const addwedding=(async(req,res)=>{
//     try {
//         const userId = req.user.userId || req.user._id;
//         const {wedding_venue,description,location,time,long,latitude,date}=req.body;
//         const avatarlocalPath=req.file?.path;
//     if(!avatarlocalPath){
//        return res.status(400).json("wedding place image not fetched");
//     }
    
//     const weddingplace_image=await uploadonCloudinary(avatarlocalPath);

//     if(!weddingplace_image){
//         return res.status(400).json("wedding place Image file is required");
//     }
//     const newWeddingplace=new Weddingplace({
//         wedding_venue,description,location,time,long,latitude,date,
//         avatar:weddingplace_image.url,createdBy: userId
//     })
//     const savedweddingplace=await newWeddingplace.save()
//     res.status(201).json(savedweddingplace)
// }catch(error){
//     console.error(error)
//     return res.status(500).json({error:"wedding place addition failed"})
// }
// })
// const updateweddingdetails=(async(req,res)=>{
//     const {id}=req.params;
//     const{wedding_venue,description,location,time,long,latitude,date,avatar}=req.body
//     try {
//         const uweddingplace=await Weddingplace.findByIdAndUpdate(
//             id,
//             {wedding_venue,description,location,time,long,latitude,date,avatar},
//             {new:true}
//         )
//         if(!uweddingplace){
//             return res.status(400).json("wedding place not found")
//         }
//         res.status(200).json(uweddingplace)
//     } catch (error) {
//         res.status(400).json("wedding places updation failed")
//     }
// })

// const deleteweddingdetails=async(req,res)=>{
//     const {id}=req.params;
//     try {
//         const dweddingplace=await Weddingplace.findByIdAndDelete(id);
//         if(!dweddingplace){
//             return res.status(400).json("wedding place not found")
//         }
//     } catch (error) {
//         res.status(400).json(" deletion failed")
//     }
// }
// // 1. FOR TOURISTS (Dashboard) - Shows Everything
// const getAllWeddings = async (req, res) => {
//     try {
//         // .find() without arguments returns EVERYTHING
//         // .populate('createdBy', 'username') is optional if you want to show who posted it
//         const events = await Weddingplace.find().populate('createdBy', 'username'); 
//         res.status(200).json(events);
//     } catch (error) {
//         res.status(500).json("Error fetching events");
//     }
// };

// // 2. FOR LOCALS (My Dashboard) - Shows Only Theirs
// const getMyWeddings = async (req, res) => {
//     try {
//         const userId = req.user.userId || req.user._id;
        
//         // FILTER: Only find events where createdBy == userId
//         const myEvents = await Weddingplace.find({ createdBy: userId }); 
        
//         res.status(200).json(myEvents);
//     } catch (error) {
//         res.status(500).json("Error fetching your events");
//     }
// };



// export{addwedding,getAllWeddings, getMyWeddings,updateweddingdetails,deleteweddingdetails}

// import Weddingplace from "../models/weddings.js";
// import { uploadonCloudinary } from "../utils/cloudnary.js";
// import cloudinary from "cloudinary";
// import fs from "fs";

// /* =========================================================
//    ADD WEDDING PLACE
// ========================================================= */
// const addwedding = async (req, res) => {
//   try {
//     const userId = req.user.userId || req.user._id;

//     const {
//       title,
//       description,
//       place_ref,
//       base_price,
//       capacity,
//       amenities,
//       longitude,
//       latitude
//     } = req.body;

//     // Validate required fields
//     if (!title || !place_ref || !longitude || !latitude) {
//       return res.status(400).json({
//         error: "Title, place_ref, longitude and latitude are required"
//       });
//     }

//     const localFilePath = req.file?.path;

//     if (!localFilePath) {
//       return res.status(400).json({ error: "Image file is required" });
//     }

//     // Upload image to Cloudinary
//     const uploadedImage = await uploadonCloudinary(localFilePath);

//     if (!uploadedImage) {
//       return res.status(400).json({ error: "Image upload failed" });
//     }

//     // Delete local file after upload
//     fs.unlinkSync(localFilePath);

//     const newWedding = new Weddingplace({
//       title,
//       description,
//       place_ref,
//       host_user: userId,
//       base_price,
//       capacity,
//       amenities: amenities ? amenities.split(",") : [],
//       location: {
//         type: "Point",
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       images: [
//         {
//           url: uploadedImage.secure_url,
//           public_id: uploadedImage.public_id
//         }
//       ]
//     });

//     const savedWedding = await newWedding.save();

//     res.status(201).json(savedWedding);

//   } catch (error) {
//     console.error("Add wedding error:", error);
//     res.status(500).json({ error: "Wedding place addition failed" });
//   }
// };


// /* =========================================================
//    UPDATE WEDDING DETAILS
// ========================================================= */
// const updateweddingdetails = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const updatedWedding = await Weddingplace.findByIdAndUpdate(
//       id,
//       req.body,
//       { new: true }
//     );

//     if (!updatedWedding) {
//       return res.status(404).json({ error: "Wedding place not found" });
//     }

//     res.status(200).json(updatedWedding);

//   } catch (error) {
//     console.error("Update wedding error:", error);
//     res.status(500).json({ error: "Wedding update failed" });
//   }
// };


// /* =========================================================
//    DELETE WEDDING (also deletes images from Cloudinary)
// ========================================================= */
// const deleteweddingdetails = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const wedding = await Weddingplace.findById(id);

//     if (!wedding) {
//       return res.status(404).json({ error: "Wedding place not found" });
//     }

//     // Delete images from Cloudinary
//     for (let img of wedding.images) {
//       if (img.public_id) {
//         await cloudinary.uploader.destroy(img.public_id);
//       }
//     }

//     await wedding.deleteOne();

//     res.status(200).json({ message: "Wedding deleted successfully" });

//   } catch (error) {
//     console.error("Delete wedding error:", error);
//     res.status(500).json({ error: "Wedding deletion failed" });
//   }
// };


// /* =========================================================
//    GET ALL WEDDINGS (For Tourists Dashboard)
// ========================================================= */
// const getAllWeddings = async (req, res) => {
//   try {
//     const weddings = await Weddingplace.find()
//       .populate("host_user", "username email");

//     res.status(200).json(weddings);

//   } catch (error) {
//     console.error("Fetch weddings error:", error);
//     res.status(500).json({ error: "Error fetching weddings" });
//   }
// };


// /* =========================================================
//    GET MY WEDDINGS (For Local Host Dashboard)
// ========================================================= */
// const getMyWeddings = async (req, res) => {
//   try {
//     const userId = req.user.userId || req.user._id;

//     const myWeddings = await Weddingplace.find({
//       host_user: userId
//     });

//     res.status(200).json(myWeddings);

//   } catch (error) {
//     console.error("Fetch my weddings error:", error);
//     res.status(500).json({ error: "Error fetching your weddings" });
//   }
// };


// export {
//   addwedding,
//   updateweddingdetails,
//   deleteweddingdetails,
//   getAllWeddings,
//   getMyWeddings
// };

// Controllers/wedding.js - REPLACE YOUR CURRENT FILE WITH THIS
// import Weddingplace from "../models/weddings.js";
// import { uploadonCloudinary } from "../utils/cloudnary.js";
// import cloudinary from "cloudinary";
// import fs from "fs";

// const addwedding = async (req, res) => {
//   try {
//     const userId = req.user.userId || req.user._id;
    
//     const {
//       title,
//       description,
//       place_ref,
//       base_price,
//       capacity,
//       amenities,
//       longitude,
//       latitude,
//       time,      // ✅ NEW - was missing
//       date       // ✅ NEW - was missing
//     } = req.body;

//     // ✅ FIXED VALIDATION - now includes time & date
//     if (!title || !place_ref || !longitude || !latitude || !time || !date) {
//       return res.status(400).json({
//         error: "Required: title, place_ref, longitude, latitude, time, date"
//       });
//     }

//     const localFilePath = req.file?.path;
//     const licenseLocalPath = req.files?.license?.[0]?.path;
//     if (!localFilePath || !licenseLocalPath) {
//       return res.status(400).json({ error: "Image required" });
//     }

//     const uploadedImage = await uploadonCloudinary(localFilePath);
//     const licenseDoc = await uploadonCloudinary(licenseLocalPath);
//     if (!uploadedImage || !licenseDoc) {
//       return res.status(400).json({ error: "Upload failed" });
//     }

//     fs.unlinkSync(localFilePath);

//     // ✅ SAVE ALL REQUIRED FIELDS
//     const newWedding = new Weddingplace({
//       title,
//       description,
//       place_ref,
//       host_user: userId,
//       base_price,
//       capacity,
//       amenities: amenities ? amenities.split(",") : [],
//       time,      // ✅ ADDED
//       date,      // ✅ ADDED
//       latitude: parseFloat(latitude),    // ✅ ADDED
//       longitude: parseFloat(longitude),  // ✅ ADDED
//       location: {
//         type: "Point",
//         coordinates: [parseFloat(longitude), parseFloat(latitude)]
//       },
//       images: [
//         {
//           url: uploadedImage.secure_url,
//           public_id: uploadedImage.public_id
//         }
//       ]
//     });

//     const savedWedding = await newWedding.save();
//     res.status(201).json(savedWedding);
    
//   } catch (error) {
//     console.error("Add wedding error:", error);
//     res.status(500).json({ 
//       error: "Failed to add", 
//       details: error.message 
//     });
//   }
// };

// const updateweddingdetails = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const updated = await Weddingplace.findByIdAndUpdate(
//       id,
//       req.body,
//       { new: true }
//     );
    
//     if (!updated) {
//       return res.status(404).json({ error: "Not found" });
//     }
    
//     res.status(200).json(updated);
//   } catch (error) {
//     res.status(500).json({ error: "Update failed" });
//   }
// };

// const deleteweddingdetails = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const wedding = await Weddingplace.findById(id);
//     if (!wedding) {
//       return res.status(404).json({ error: "Not found" });
//     }

//     // Delete images from Cloudinary
//     for (let img of wedding.images) {
//       if (img.public_id) {
//         await cloudinary.uploader.destroy(img.public_id);
//       }
//     }

//     await wedding.deleteOne();
//     res.status(200).json({ message: "Deleted" });
    
//   } catch (error) {
//     res.status(500).json({ error: "Delete failed" });
//   }
// };

// const getAllWeddings = async (req, res) => {
//   try {
//     const weddings = await Weddingplace.find()
//       .populate("host_user", "username email")
//       .populate("place_ref", "name area");
      
//     res.status(200).json(weddings);
//   } catch (error) {
//     res.status(500).json({ error: "Fetch failed" });
//   }
// };

// const getMyWeddings = async (req, res) => {
//   try {
//     const userId = req.user.userId || req.user._id;
    
//     const myWeddings = await Weddingplace.find({
//       host_user: userId
//     }).populate("place_ref", "name area");
    
//     res.status(200).json(myWeddings);
//   } catch (error) {
//     res.status(500).json({ error: "Fetch failed" });
//   }
// };

// export {
//   addwedding,
//   updateweddingdetails,
//   deleteweddingdetails,
//   getAllWeddings,
//   getMyWeddings
// };


import Weddingplace from "../models/weddings.js";
import { Profile } from "../models/Profile_temp.js"; // ✅ NEW: For Gatekeeper
import { uploadonCloudinary } from "../utils/cloudnary.js";
import { v2 as cloudinary } from "cloudinary"; // ✅ FIXED: was bare import
import fs from "fs";

const addwedding = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    // ✅ GATEKEEPER CHECK
    const userProfile = await Profile.findOne({ user: userId });
    if (!userProfile || userProfile.verification_status !== "approved") {
        return res.status(403).json({ 
            error: "You cannot add a wedding venue until your Local Profile is verified by an admin." 
        });
    }

    const {
      title,
      description,
      place_ref,
      base_price,
      capacity,
      amenities,
      longitude,
      latitude,
      time,      
      date       
    } = req.body;

    if (!title || !place_ref || !longitude || !latitude || !time || !date) {
      return res.status(400).json({
        error: "Required: title, place_ref, longitude, latitude, time, date"
      });
    }

    // ❌ BUG FIXED: Changed req.file to req.files.avatar
    const localFilePath = req.files?.avatar?.[0]?.path;
    const licenseLocalPath = req.files?.license?.[0]?.path;

    if (!localFilePath || !licenseLocalPath) {
      return res.status(400).json({ error: "Both an Image and a License are required" });
    }

    const uploadedImage = await uploadonCloudinary(localFilePath);
    const licenseDoc = await uploadonCloudinary(licenseLocalPath);

    if (!uploadedImage || !licenseDoc) {
      return res.status(400).json({ error: "Upload failed" });
    }

    fs.unlinkSync(localFilePath);

    const newWedding = new Weddingplace({
      title,
      description,
      place_ref,
      host_user: userId,
      base_price,
      capacity,
      amenities: amenities ? amenities.split(",") : [],
      time,      
      date,      
      latitude: parseFloat(latitude),    
      longitude: parseFloat(longitude),  
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      images: [
        {
          url: uploadedImage.secure_url,
          public_id: uploadedImage.public_id
        }
      ],
      license_url: licenseDoc.secure_url // ❌ BUG FIXED: Saved the license to DB
    });

    const savedWedding = await newWedding.save();
    res.status(201).json({
        message: "Wedding place submitted successfully. Awaiting Admin verification.",
        wedding: savedWedding
    });
    
  } catch (error) {
    console.error("Add wedding error:", error);
    res.status(500).json({ 
      error: "Failed to add", 
      details: error.message 
    });
  }
};

const updateweddingdetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId || req.user._id;
  try {
    const wedding = await Weddingplace.findById(id);
    if (!wedding) {
      return res.status(404).json({ error: "Wedding venue not found" });
    }
    // ✅ Ownership check
    if (wedding.host_user.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You are not authorized to update this wedding venue" });
    }
    const allowedUpdates = {
      title: req.body.title || wedding.title,
      description: req.body.description || wedding.description,
      base_price: req.body.base_price || wedding.base_price,
      capacity: req.body.capacity || wedding.capacity,
      amenities: req.body.amenities ? req.body.amenities.split(",") : wedding.amenities,
      time: req.body.time || wedding.time,
      date: req.body.date || wedding.date,
    };
    const updated = await Weddingplace.findByIdAndUpdate(id, allowedUpdates, { new: true });
    res.status(200).json({ message: "Wedding venue updated", wedding: updated });
  } catch (error) {
    console.error("Update wedding error:", error);
    res.status(500).json({ error: "Update failed" });
  }
};

const deleteweddingdetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId || req.user._id;
  try {
    const wedding = await Weddingplace.findById(id);
    if (!wedding) {
      return res.status(404).json({ error: "Wedding venue not found" });
    }
    // ✅ Ownership check
    if (wedding.host_user.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You are not authorized to delete this wedding venue" });
    }
    await Weddingplace.findByIdAndDelete(id);
    res.status(200).json({ message: "Wedding venue deleted successfully" });
  } catch (error) {
    console.error("Delete wedding error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
};

// ✅ FOR TOURISTS - Shows ONLY VERIFIED Weddings
const getAllWeddings = async (req, res) => {
  try {
    const weddings = await Weddingplace.find({ verified: true }) // Added filter
      .populate("host_user", "username email")
      .populate("place_ref", "name area");
      
    res.status(200).json(weddings);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
};

// FOR LOCALS - Shows all theirs
const getMyWeddings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    const myWeddings = await Weddingplace.find({
      host_user: userId
    }).populate("place_ref", "name area");
    
    res.status(200).json(myWeddings);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
};

export {
  addwedding,
  updateweddingdetails,
  deleteweddingdetails,
  getAllWeddings,
  getMyWeddings
};