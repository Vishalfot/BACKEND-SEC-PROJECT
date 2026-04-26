import express from "express";
const router = express.Router();
import { upload } from "../middleware/multer.js";
import authentication from "../middleware/authentication.js";
// Ensure the filename matches your actual controller file
import {
    addproduct,
    updateproduct,
    deleteproduct,
    getAllProducts,
    getMyProducts
} from "../Controllers/addproduct.js";

// ── CREATE ──
// Matches: POST /api/products/add
router.post("/add", authentication, upload.single("avatar"), addproduct);

// ── READ (Public) ──
// Matches: GET /api/products/all
router.get("/all", getAllProducts);

// ── READ (Private) ──
// Matches: GET /api/products/myproducts
router.get("/myproducts", authentication, getMyProducts);

// ── UPDATE ──
// Matches: PATCH /api/products/update/:id
router.patch("/update/:id", authentication, updateproduct);

// ── DELETE ──
// Matches: DELETE /api/products/delete/:id
router.delete("/delete/:id", authentication, deleteproduct);

export default router;
