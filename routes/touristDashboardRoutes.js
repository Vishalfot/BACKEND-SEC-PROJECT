const express = require('express');
const router = express.Router();

// Dummy sample data - replace with actual DB queries
const samplePurchases = [
  { id: 1, item: "Heritage Tour Package", date: "2025-10-01", price: 1200 },
  { id: 2, item: "Homestay in Mysore", date: "2025-10-15", price: 350 }
];

const sampleSavedItineraries = [
  { id: "itinerary1", title: "Golden Triangle Tour", savedOn: "2025-09-15" },
  { id: "itinerary2", title: "South India Exploration", savedOn: "2025-10-05" }
];

const sampleBookings = [
  { id: "booking1", experience: "Taj Mahal Entry & Guide", date: "2025-11-20", status: "Confirmed" },
  { id: "booking2", experience: "Kerala Backwater Tour", date: "2025-12-02", status: "Pending" }
];

const sampleWishlist = [
  { id: "place1", name: "Ajanta Caves" },
  { id: "place2", name: "Rajasthan Camel Safari" }
];

const sampleCommunityPosts = [
  {
    id: "post1",
    user: "TouristAlice",
    image: "/images/agra_fort.jpg",
    caption: "Amazing sunset at Agra Fort!"
  },
  {
    id: "post2",
    user: "TravelerBob",
    video: "/videos/kerala_boatride.mp4",
    caption: "Peaceful backwaters of Kerala."
  }
];

// Route definitions
router.get('/purchases', (req, res) => res.json(samplePurchases));
router.get('/saved-itineraries', (req, res) => res.json(sampleSavedItineraries));
router.get('/bookings', (req, res) => res.json(sampleBookings));
router.get('/wishlist', (req, res) => res.json(sampleWishlist));
router.get('/community-posts', (req, res) => res.json(sampleCommunityPosts));

module.exports = router;
