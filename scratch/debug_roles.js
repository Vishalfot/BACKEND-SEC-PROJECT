import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({ role: String });
const User = mongoose.model('User_Debug', UserSchema, 'users');

async function debug() {
    await mongoose.connect(process.env.URI);
    const roles = await User.distinct('role');
    console.log('Unique Roles in DB:', roles);
    
    const localCount = await User.countDocuments({ role: 'Local' });
    const lowercaseLocalCount = await User.countDocuments({ role: 'local' });
    console.log('Count "Local":', localCount);
    console.log('Count "local":', lowercaseLocalCount);

    const allUsers = await User.find({}).limit(10);
    console.log('Sample Users:', allUsers.map(u => ({ id: u._id, role: u.role })));

    process.exit(0);
}

debug();
