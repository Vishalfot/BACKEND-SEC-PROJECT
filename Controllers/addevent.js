import Event from "../models/Event.js";
import { Profile } from "../models/Profile_temp.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";

/**
 * ── LOCAL PARTNER: ADD NEW EVENT ──
 * Validates profile status, uploads images, and saves GeoJSON data.
 */
export const addevent = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // 1. Gatekeeper: Ensure the user is a verified Local Partner
        const userProfile = await Profile.findOne({ user: userId });
        if (!userProfile || userProfile.verification_status !== "approved") {
            return res.status(403).json({ 
                error: "You cannot add events until your Local Profile is verified by an admin." 
            });
        }

        const {
            event_name, description, address, organizer_name,
            experience_type, category, event_date, start_time, end_time,
            latitude, longitude, tags, price, capacity, booking_required
        } = req.body;

        // 2. Strict Field Validation
        if (!event_name || !description || !address || !organizer_name || !event_date || !capacity) {
            return res.status(400).json({ error: "Missing required fields. Capacity and Organizer Name are mandatory." });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({ error: "Location coordinates are required to pin this on the discovery map." });
        }

        // 3. File Handling (Cloudinary)
        const avatarlocalPath = req.files?.avatar?.[0]?.path;
        const licenseLocalPath = req.files?.license?.[0]?.path;

        if (!avatarlocalPath || !licenseLocalPath) {
            return res.status(400).json({ error: "Both an Event Image and a License/Permit are required." });
        }

        const image = await uploadonCloudinary(avatarlocalPath);
        const licenseDoc = await uploadonCloudinary(licenseLocalPath);

        // 4. Data Formatting
        const tagArray = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : (tags || []);

        const newEvent = new Event({
            event_name,
            description,
            address,
            organizer_name,
            experience_type: experience_type || "local_experience",
            category: category || "Other", // ✅ Added
            event_date: new Date(event_date),
            start_time,
            end_time,
            location: {
                type: "Point",
                coordinates: [parseFloat(longitude), parseFloat(latitude)] // [long, lat]
            },
            avatar: image.secure_url,
            license_url: licenseDoc.secure_url,
            tags: tagArray,
            price: parseFloat(price) || 0,
            capacity: parseInt(capacity),
            booking_required: booking_required === 'true',
            createdBy: userId,
            status: "upcoming",
            ticket_status: "available",
            verified: false // Awaiting admin approval
        });

        await newEvent.save();

        res.status(201).json({
            success: true,
            message: "Event submitted successfully. It will be visible to tourists once verified.",
            event: newEvent
        });

    } catch (error) {
        console.error("Add Event Error:", error);
        res.status(500).json({ error: "Internal Server Error during event creation." });
    }
};

/**
 * ── TOURIST: DISCOVERY ENGINE (GET ALL) ──
 * Filters by 'verified: true' and allows proximity search.
 */
export const getAllEvents = async (req, res) => {
    try {
        const { lat, lng, dist = 10000 } = req.query; // default 10km radius
        let filter = { verified: true };

        // Geospatial Proximity Logic
        if (lat && lng) {
            filter.location = {
                $near: {
                    $geometry: { 
                        type: "Point", 
                        coordinates: [parseFloat(lng), parseFloat(lat)] 
                    },
                    $maxDistance: parseInt(dist)
                }
            };
        }

        const events = await Event.find(filter)
            .populate("createdBy", "username name avatar")
            .sort(lat && lng ? null : { event_date: 1 })
            .lean();

        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch events." });
    }
};

/**
 * ── TOURIST: SINGLE EVENT DETAILS ──
 */
export const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate("createdBy", "name avatar");

        if (!event) return res.status(404).json({ error: "Event not found" });
        
        // Block viewing unverified events by direct link (unless it's the owner)
        if (!event.verified && event.createdBy._id.toString() !== req.user?._id?.toString()) {
            return res.status(403).json({ error: "This event is currently under review." });
        }

        res.json(event);
    } catch (error) {
        res.status(500).json({ error: "Invalid Event ID" });
    }
};

/**
 * ── LOCAL PARTNER: UPDATE EVENT ──
 * Resets verification status on edit to prevent unauthorized changes.
 */
export const updateevent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;

        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ error: "Event not found" });

        if (event.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized: You do not own this event." });
        }

        // Reset verification on update (Unified Standard)
        const updatedData = { 
            ...req.body, 
            verificationStatus: "pending",
            verified: false, 
            rejected: false,
            adminFeedback: "" // Clear old feedback
        };
        
        const updatedEvent = await Event.findByIdAndUpdate(id, updatedData, { new: true });
        res.json({ message: "Event updated and re-queued for verification.", event: updatedEvent });

    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
};

/**
 * ── LOCAL PARTNER: DELETE EVENT ──
 */
export const deleteevent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;

        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ error: "Event not found" });

        if (event.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized: Access Denied." });
        }

        await event.deleteOne();
        res.json({ message: "Event deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
};

/**
 * ── LOCAL PARTNER: VIEW OWN LISTINGS ──
 */
export const getMyEvents = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const events = await Event.find({ createdBy: userId }).sort("-createdAt");
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
};