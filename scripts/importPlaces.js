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

// Excel file path — new v2 sheet
const excelPath = path.join(__dirname, "../delhi_final_v2.xlsx");

// Helper: parse comma-separated string to array
const splitComma = (val) =>
  val ? String(val).split(",").map((s) => s.trim()).filter(Boolean) : [];

// Helper: parse boolean-ish Excel cell
const parseBool = (val) =>
  val === true || val === 1 || String(val).toLowerCase() === "true" || String(val).toLowerCase() === "yes";

// MAIN FUNCTION
const importPlaces = async () => {
  try {

    // ✅ Connect DB
    await mongoose.connect(process.env.URI);
    console.log("MongoDB Connected");

    // ✅ Drop old data
    await Place.deleteMany({});
    console.log("Old places deleted");

    // ✅ Read Excel File
    const workbook = xlsx.readFile(excelPath);

    // Select "Places" sheet
    const sheet = workbook.Sheets["Places"];
    if (!sheet) {
      throw new Error('Sheet "Places" not found in Excel file');
    }

    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Total rows found: ${rows.length}`);

    // ✅ Transform Function — maps all 29 Excel columns to the flat schema
    const transformPlace = (row) => ({
      _id: String(row._id).trim(),

      name:     row.name,
      category: row.category,
      area:     row.area,

      // GeoJSON point
      location: {
        type:        "Point",
        coordinates: [Number(row.longitude), Number(row.latitude)],
      },

      // Flat copies for app-layer math
      latitude:  Number(row.latitude),
      longitude: Number(row.longitude),

      scores: {
        cultural:   Number(row.cultural_score)   || 0,
        popularity: Number(row.popularity_score) || 0,
      },

      avg_visit_duration_min: Number(row.avg_visit_duration_min) || 60,

      best_time_of_day: splitComma(row.best_time_of_day),
      open_days:        splitComma(row.open_days),
      tags:             splitComma(row.tags),

      entry_fee: {
        indian:    Number(row.entry_fee_indian)    || 0,
        foreigner: Number(row.entry_fee_foreigner) || 0,
      },

      amenities: {
        food_nearby:     parseBool(row.food_nearby),
        shopping_nearby: parseBool(row.shopping_nearby),
        parking:         parseBool(row.parking_available),
      },

      short_description:    row.short_description    || "",
      image_filename:       row.image_filename       || "",
      is_anchor_place:      parseBool(row.is_anchor_place),
      anchor_event_details: row.anchor_event_details || "",
      source:               row.source               || "",
      official_website:     row.official_website     || "",

      metro: {
        nearest_station: row.nearest_metro   || "",
        line:            row.metro_line      || "",
        distance_m:      Number(row.metro_distance_m) || 0,
      },

      cluster: {
        id:          row.cluster_id         || null,
        anchor_id:   row.cluster_anchor_id  || null,
        visit_order: row.cluster_visit_order != null ? Number(row.cluster_visit_order) : null,
      },

      is_sub_place:    false,
      parent_place_id: null,
      verified:        true,
    });

    // ✅ Remove empty rows
    const validRows = rows.filter((row) => row._id);
    console.log(`Valid rows to import: ${validRows.length}`);

    // ✅ Bulk upsert
    const operations = validRows.map((row) => {
      const place = transformPlace(row);
      return {
        updateOne: {
          filter: { _id: place._id },
          update: { $set: place },
          upsert: true,
        },
      };
    });

    await Place.bulkWrite(operations);
    console.log("All places imported successfully 🚀");

    process.exit(0);

  } catch (error) {
    console.error("Import Failed:", error);
    process.exit(1);
  }
};

importPlaces();
