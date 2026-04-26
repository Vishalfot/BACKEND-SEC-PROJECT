import Weddingplace from "../models/weddings.js";
import { Profile } from "../models/Profile_temp.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

/**
 * ── LOCAL PARTNER: ADD WEDDING ──
 * Supports multiple programs (Haldi, Sangeet, etc.) within one listing.
 */
export const addwedding = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    // 1. Gatekeeper Check
    const userProfile = await Profile.findOne({ user: userId });
    if (!userProfile || userProfile.verification_status !== "approved") {
        return res.status(403).json({ 
            error: "You cannot add a wedding venue until your Local Profile is verified." 
        });
    }

    const {
      title, description, address, place_ref, full_package_price,
      longitude, latitude, amenities,
      programs
    } = req.body;

    // 2. Validation
    if (!title || !address || !longitude || !latitude || !programs) {
      return res.status(400).json({ error: "Title, Address, Location, and Wedding programs are required." });
    }

    // 3. File Handling
    const localFilePath = req.files?.avatar?.[0]?.path;
    const licenseLocalPath = req.files?.license?.[0]?.path;

    if (!localFilePath || !licenseLocalPath) {
      return res.status(400).json({ error: "Wedding thumbnail and License permit are required." });
    }

    const uploadedImage = await uploadonCloudinary(localFilePath);
    const licenseDoc = await uploadonCloudinary(licenseLocalPath);

    // 4. Parse Programs
    const parsedPrograms = typeof programs === 'string' ? JSON.parse(programs) : programs;

    const newWedding = new Weddingplace({
      title,
      description,
      address,
      place_ref,
      host_user: userId,
      full_package_price: parseFloat(full_package_price) || 0,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      programs: parsedPrograms,
      amenities: amenities ? (Array.isArray(amenities) ? amenities : amenities.split(",")) : [],
      images: [{
        url: uploadedImage.secure_url,
        public_id: uploadedImage.public_id
      }],
      license_url: licenseDoc.secure_url,
      verified: false // Admin must verify the "Cultural Authenticity"
    });

    const savedWedding = await newWedding.save();
    res.status(201).json({
        message: "Wedding submitted for verification.",
        wedding: savedWedding
    });
    
  } catch (error) {
    console.error("ADD WEDDING ERROR DETAILS:", {
        message: error.message,
        stack: error.stack,
        body: req.body
    });
    res.status(500).json({ error: "Submission failed", details: error.message });
  }
};

/**
 * ── TOURIST: GET ALL VERIFIED WEDDINGS ──
 */
export const getAllWeddings = async (req, res) => {
  try {
    const { lat, lng, dist = 15000 } = req.query;
    let query = { verified: true };

    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(dist)
        }
      };
    }

    const weddings = await Weddingplace.find(query)
      .populate("host_user", "username name avatar")
      .populate("place_ref", "name area")
      .lean();
      
    res.status(200).json(weddings);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
};

/**
 * ── SECURE DELETE ──
 */
export const deleteweddingdetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id;
    
    const wedding = await Weddingplace.findById(id);
    if (!wedding) return res.status(404).json({ error: "Wedding not found" });

    // Ownership Check
    if (wedding.host_user.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    // Optional: Cleanup Cloudinary images
    if (wedding.images?.[0]?.public_id) {
        await cloudinary.uploader.destroy(wedding.images[0].public_id);
    }

    await wedding.deleteOne();
    res.status(200).json({ message: "Wedding listing removed." });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};
/**
 * ── LOCAL PARTNER: VIEW OWN LISTINGS ──
 * Shows the local host all the weddings they have added, 
 * regardless of verification status.
 */
export const getMyWeddings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const myWeddings = await Weddingplace.find({ host_user: userId })
      .populate("place_ref", "name area") // Useful for dashboard display
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: myWeddings.length,
      weddings: myWeddings
    });
  } catch (error) {
    console.error("Fetch My Weddings Error:", error);
    res.status(500).json({ error: "Failed to fetch your wedding listings." });
  }
};

/**
 * ── LOCAL PARTNER: UPDATE WEDDING DETAILS ──
 * 1. Verifies ownership.
 * 2. Resets 'verified' status to false (must be re-checked by admin).
 * 3. Handles partial updates to programs or basic info.
 */
export const updateweddingdetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id;

    // 1. Find and check ownership
    const wedding = await Weddingplace.findById(id);
    if (!wedding) {
      return res.status(404).json({ error: "Wedding listing not found." });
    }

    if (wedding.host_user.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized: Access denied." });
    }

    // 2. Prepare Updates
    // If programs are updated, they replace the old array
    const updates = { ...req.body };
    
    // Logic: If they update critical info, we MUST re-verify (Unified Standard)
    updates.status = "pending";
    updates.verified = false;
    updates.rejected = false;
    updates.adminFeedback = ""; // Clear old feedback

    // 3. Update the document
    const updatedWedding = await Weddingplace.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Wedding updated and re-queued for admin verification.",
      wedding: updatedWedding
    });
  } catch (error) {
    console.error("Update Wedding Error:", error);
    res.status(500).json({ error: "Failed to update wedding details." });
  }
};