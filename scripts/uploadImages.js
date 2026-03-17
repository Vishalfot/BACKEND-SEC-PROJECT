import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Place from "../models/PlaceSchema.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, "../images/delhi_places");

await mongoose.connect(process.env.URI);
console.log("MongoDB Connected");

const uploadAllImages = async () => {
  try {

    const files = fs.readdirSync(folderPath);

    for (const file of files) {

      if (!file.match(/\.(jpg|jpeg|png)$/i)) {
        console.log("Skipping non-image:", file);
        continue;
      }

      const placeId = path.parse(file).name;
      const fullPath = path.join(folderPath, file);

      console.log("Uploading:", placeId);

      // 🔎 Check if place exists
      const placeExists = await Place.findById(placeId);

      if (!placeExists) {
        console.log("No matching place found for:", placeId);
        continue;
      }

      const response = await uploadonCloudinary(fullPath, {
        public_id: `places/${placeId}`,
        overwrite: true
      });

      if (!response) {
        console.log("Upload failed:", placeId);
        continue;
      }

      // ✅ Update Mongo
      await Place.findByIdAndUpdate(placeId, {
        $set: {
          media: {
            images: [
              {
                url: response.secure_url,
                public_id: response.public_id,
                is_primary: true
              }
            ]
          }
        }
      });

      console.log("Updated Mongo for:", placeId);
    }

    console.log("All uploads completed 🚀");
    process.exit();

  } catch (error) {
    console.error("Upload Script Failed:", error);
    process.exit(1);
  }
};

uploadAllImages();
