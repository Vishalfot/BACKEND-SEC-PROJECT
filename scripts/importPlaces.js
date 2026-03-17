import mongoose from "mongoose";
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Place from "../models/PlaceSchema.js";

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Excel file path
const excelPath = path.join(__dirname, "../delhi_tourism_places_complete.xlsx");

// MAIN FUNCTION
const importPlaces = async () => {
  try {

    // ✅ Connect DB
    await mongoose.connect(process.env.URI);
    console.log("MongoDB Connected");
    await Place.deleteMany({});
    console.log("Old places deleted");
    // ✅ Read Excel File
    const workbook = xlsx.readFile(excelPath);

    // IMPORTANT: Select "Places" sheet explicitly
    const sheet = workbook.Sheets["Places"];

    if (!sheet) {
      throw new Error('Sheet "Places" not found in Excel file');
    }

    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`Total rows found: ${rows.length}`);

    // ✅ Transform Function
    const transformPlace = (row) => ({
      _id: row._id.toString().trim(),

      name: row.name,
      category: row.category,
      area: row.area,

      amenities: {
        food_nearby:
          row.food_nearby === true ||
          row.food_nearby === "TRUE" ||
          row.food_nearby === "Yes",

        shopping_nearby:
          row.shopping_nearby === true ||
          row.shopping_nearby === "TRUE" ||
          row.shopping_nearby === "Yes",

        parking_available:
          row.parking_available === true ||
          row.parking_available === "TRUE" ||
          row.parking_available === "Yes",

        restroom_available: false,
        wheelchair_accessible: false
      },

      location: {
        type: "Point",
        coordinates: [
          Number(row.longitude),
          Number(row.latitude)
        ]
      },

      scores: {
        cultural_score: Number(row.cultural_score) || 0,
        popularity_score: Number(row.popularity_score) || 0
      },

      visit_info: {
        avg_duration_min: Number(row.avg_visit_duration_min) || 60,
        best_time_of_day: row.best_time_of_day
          ? row.best_time_of_day.split(",").map(s => s.trim())
          : [],
        open_days: row.open_days
          ? row.open_days.split(",").map(s => s.trim())
          : []
      },

      pricing: {
        entry_fee: {
          indian_adult: Number(row.entry_fee_indian) || 0,
          foreigner_adult: Number(row.entry_fee_foreigner) || 0
        }
      },

      special_features: {
        is_anchor_place:
          row.is_anchor_place === "Yes" ||
          row.is_anchor_place === true,

        has_local_experience: false,

        anchor_event_details:
          row.anchor_event_details || null
      },

      tags: row.tags
        ? row.tags.split(",").map(s => s.trim())
        : [],

      description: {
        short: row.short_description || ""
      },

      media: {
        images: []
      },

      source: row.source
        ? row.source.split(",").map(s => s.trim())
        : []
    });

    // ✅ Remove empty rows safely
    const validRows = rows.filter(row => row._id);

    console.log(`Valid rows to import: ${validRows.length}`);

    // ✅ Bulk Upsert (Fast & Professional Way)
    const operations = validRows.map(row => {
      const place = transformPlace(row);

      return {
        updateOne: {
          filter: { _id: place._id },
          update: { $set: place },
          upsert: true
        }
      };
    });

    await Place.bulkWrite(operations);

    console.log("All places imported successfully 🚀");

    process.exit();

  } catch (error) {
    console.error("Import Failed:", error);
    process.exit(1);
  }
};

importPlaces();
