import Homestay from "../models/Homestay.js";

/**
 * ── TOURIST: DISCOVERY ENGINE ──
 * Logic: Fetch only approved listings. Prioritize by proximity if GPS is shared.
 */
export const getAllHomestays = async (req, res) => {
  try {
    const { lat, lng, maxDist = 10000, city } = req.query; 
    const filter = { status: "approved" };

    // 1. Proximity Search: Uses the 2dsphere index for "Nearby" discovery
    if (lat && lng) {
      filter.location = {
        $near: {
          $geometry: { 
            type: "Point", 
            coordinates: [parseFloat(lng), parseFloat(lat)] 
          },
          $maxDistance: parseInt(maxDist) 
        }
      };
    } 
    // 2. City Filter: Basic search if GPS is not provided
    else if (city) {
      filter.city = { $regex: city.trim(), $options: "i" };
    }

    const homestays = await Homestay.find(filter).lean();
    res.json(homestays);
  } catch (err) {
    res.status(500).json({ error: "Discovery failed: " + err.message });
  }
};

/**
 * ── TOURIST: VIEW DETAILS ──
 * Populates host info so tourists can see who they are staying with.
 */
// export const getHomestayById = async (req, res) => {
//   try {
//     const hs = await Homestay.findById(req.params.id)
//       .populate("submitted_by", "name avatar bio"); 
    
//     if (!hs) return res.status(404).json({ error: "Homestay not found" });
//     res.json(hs);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };
export const getHomestayById = async (req, res) => {
  try {
    const hs = await Homestay.findById(req.params.id)
      .populate("submitted_by", "name avatar bio"); 
    
    if (!hs) return res.status(404).json({ error: "Homestay not found" });

    // ADD THIS: Prevent tourists from seeing unverified listings via direct link
    if (hs.status !== "approved" && hs.submitted_by._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "This listing is currently under review." });
    }

    res.json(hs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ── LOCAL PARTNER: SUBMIT LISTING ──
 * Formats the incoming address/coords into the GeoJSON format.
 */
import { uploadonCloudinary } from "../utils/cloudnary.js";

export const submitHomestay = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    // 1. Image Upload
    const localFilePath = req.file?.path;
    if (!localFilePath) {
      return res.status(400).json({ error: "Homestay image is required." });
    }
    const uploadedImage = await uploadonCloudinary(localFilePath);
    if (!uploadedImage) {
      return res.status(400).json({ error: "Image upload to Cloudinary failed." });
    }

    // 2. Extract Data
    const { 
      lat, lng, 
      latitude, longitude,
      ...rest 
    } = req.body;

    const finalLat = latitude || lat;
    const finalLng = longitude || lng;

    if (!finalLat || !finalLng) {
      return res.status(400).json({ error: "Location coordinates (lat/lng) are required." });
    }

    // 3. Create Listing
    const hs = await Homestay.create({
      ...rest,
      location: {
        type: "Point",
        coordinates: [parseFloat(finalLng), parseFloat(finalLat)]
      },
      images: [{
        url: uploadedImage.secure_url,
        public_id: uploadedImage.public_id
      }],
      amenities: rest.amenities ? (Array.isArray(rest.amenities) ? rest.amenities : rest.amenities.split(",").map(a => a.trim())) : [],
      submitted_by: userId,
      status: "pending",
    });

    res.status(201).json({ 
      message: "Listing submitted. It will be live after admin verification.", 
      homestay: hs 
    });
  } catch (err) {
    console.error("Submit Homestay Error:", err);
    res.status(400).json({ error: "Validation Error: " + err.message });
  }
};

/**
 * ── LOCAL PARTNER: MANAGE OWN LISTINGS ──
 * Allows locals to see the status (Pending/Approved/Rejected) of their own homes.
 */
export const getMyHomestays = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const list = await Homestay.find({ submitted_by: userId }).sort("-createdAt");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ── LOCAL PARTNER: UPDATE LISTING ──
 * Resets status to 'pending' on any edit.
 */
export const updateHomestay = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id;

    const hs = await Homestay.findById(id);
    if (!hs) return res.status(404).json({ error: "Homestay not found" });

    if (hs.submitted_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized update" });
    }

    const { lat, lng, ...rest } = req.body;
    const updates = { ...rest, status: "pending", admin_note: "" };

    if (lat && lng) {
      updates.location = {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)]
      };
    }

    const updated = await Homestay.findByIdAndUpdate(id, updates, { new: true });
    res.json({ message: "Listing updated and sent for re-verification", homestay: updated });
  } catch (err) {
    res.status(500).json({ error: "Update failed: " + err.message });
  }
};

/**
 * ── SECURE DELETE ──
 * Ensures only the original owner can remove their listing.
 */
export const deleteHomestay = async (req, res) => {
  try {
    // 1. Find the listing
    const hs = await Homestay.findById(req.params.id);
    if (!hs) return res.status(404).json({ error: "Homestay not found" });

    // 2. Security Check: Is the requester the owner?
    const userId = req.user.userId || req.user._id;
    if (hs.submitted_by.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized: You do not own this listing." });
    }

    await hs.deleteOne();
    res.json({ message: "Listing deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
