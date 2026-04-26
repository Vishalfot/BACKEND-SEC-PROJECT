import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProfileSchema = new mongoose.Schema({}, { strict: false });
const Profile = mongoose.model('Profile_Debug', ProfileSchema, 'profiles');

async function debug() {
    await mongoose.connect(process.env.URI);
    
    const p = await Profile.findOne({ name: 'Mayank Agarwal' });
    console.log('Profile Mayank:', p ? { id: p._id, role: p.role, name: p.name } : 'Not found');

    const p2 = await Profile.findOne({ name: 'gaurav' });
    console.log('Profile gaurav:', p2 ? { id: p2._id, role: p2.role, name: p2.name } : 'Not found');

    process.exit(0);
}

debug();
