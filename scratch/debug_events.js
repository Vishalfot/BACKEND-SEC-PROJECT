import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const EventSchema = new mongoose.Schema({}, { strict: false });
const Event = mongoose.model('Event_Debug', EventSchema, 'events');

async function debug() {
    await mongoose.connect(process.env.URI);
    
    const count1 = await Event.countDocuments({ verificationStatus: 'approved' });
    const count2 = await Event.countDocuments({ status: 'approved' });
    const count3 = await Event.countDocuments({ verified: true });
    
    console.log('Events with verificationStatus: approved ->', count1);
    console.log('Events with status: approved ->', count2);
    console.log('Events with verified: true ->', count3);

    const sample = await Event.findOne({ verified: true });
    console.log('Sample Approved Event:', sample);

    process.exit(0);
}

debug();
