
import { Product } from "../models/Product.js";
import { Profile } from "../models/Profile_temp.js"; // ✅ NEW: Needed for Gatekeeper
import { uploadonCloudinary } from "../utils/cloudnary.js";

const addproduct = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // ✅ GATEKEEPER CHECK: Ensure the local's profile is approved first
        const userProfile = await Profile.findOne({ user: userId });
        if (!userProfile || userProfile.verification_status !== "approved") {
            return res.status(403).json({
                error: "You cannot add products until your Local Profile is verified by an admin."
            });
        }

        const { product_name, description, price } = req.body;

        // Since we used upload.single("avatar") in the route, req.file works perfectly here!
        const avatarlocalPath = req.file?.path;

        if (!avatarlocalPath) {
            return res.status(400).json({ error: "Product image is required" });
        }

        const product_image = await uploadonCloudinary(avatarlocalPath);

        if (!product_image) {
            return res.status(400).json({ error: "Product image upload failed" });
        }

        const newProduct = new Product({
            product_name,
            description,
            price,
            avatar: product_image.secure_url, // ✅ Changed to secure_url
            createdBy: userId
            // verified defaults to false automatically based on your model!
        });

        const savedproduct = await newProduct.save();
        res.status(201).json({
            message: "Product submitted successfully. Awaiting Admin verification.",
            product: savedproduct
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Product listing failed" });
    }
};

const updateproduct = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        // ✅ Ownership check: only the creator can update
        if (product.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You are not authorized to update this product" });
        }
        const { product_name, description, price } = req.body;
        const updatedData = {
            product_name: product_name || product.product_name,
            description: description || product.description,
            price: price || product.price
        };
        const updated = await Product.findByIdAndUpdate(id, updatedData, { new: true });
        res.status(200).json({ message: "Product updated successfully", product: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Product update failed" });
    }
};

const deleteproduct = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId || req.user._id;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        // ✅ Ownership check: only the creator can delete
        if (product.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You are not authorized to delete this product" });
        }
        await Product.findByIdAndDelete(id);
        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Product deletion failed" });
    }
};

// 1. FOR TOURISTS (Dashboard) - Shows Only VERIFIED Products
// const getAllProducts = async (req, res) => {
//     try {
//         // ✅ CHANGED: Added { verified: true }
//         const products = await Product.find({ verified: true }).populate('createdBy', 'username'); 
//         res.status(200).json(products);
//     } catch (error) {
//         res.status(500).json({ error: "Error fetching products" });
//     }
// };

// // 2. FOR LOCALS (My Dashboard) - Shows All Theirs (Pending & Approved)
// const getMyProducts = async (req, res) => {
//     try {
//         const userId = req.user.userId || req.user._id;

//         const myProducts = await Product.find({ createdBy: userId }); 

//         res.status(200).json(myProducts);
//     } catch (error) {
//         res.status(500).json({ error: "Error fetching your products" });
//     }
// };
const getAllProducts = async (req, res) => {
    try {
        // ✅ Robust filter: show products that are verified AND not explicitly rejected
        const products = await Product.find({ 
            verified: true, 
            rejected: { $ne: true } 
        }).lean(); 

        // Fetch all relevant profiles in ONE query (not N+1)
        const sellerIds = [...new Set(products.map(p => p.createdBy?.toString()))];
        const profiles = await Profile.find({ user: { $in: sellerIds } }).lean();

        // Build a Map for O(1) lookups
        const profileMap = {};
        profiles.forEach(p => { profileMap[p.user.toString()] = p; });

        // Attach artisan info onto each product
        const enriched = products.map(product => {
            const profile = profileMap[product.createdBy?.toString()] || {};
            return {
                ...product,
                artisanName:   profile.name || 'Local Artisan',
                artisanBio:    profile.about || '',        // ← becomes the artisan story
                artisanAvatar: profile.avatar || null,      // ← Cloudinary URL
                artisanCity:   profile.city || profile.country || 'India',
            };
        });

        res.status(200).json(enriched);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching products" });
    }
};

// GET /product/myproducts  — products created by the logged-in local
const getMyProducts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const products = await Product.find({ createdBy: userId }).lean();
        res.status(200).json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching your products" });
    }
};
export { addproduct, getAllProducts, getMyProducts, updateproduct, deleteproduct };