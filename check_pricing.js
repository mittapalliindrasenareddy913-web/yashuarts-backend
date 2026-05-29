import { connectDB } from './config/db.js';
import Pricing from './models/Pricing.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPricing() {
  await connectDB();
  const pricing = await Pricing.find({});
  console.log("=== PRICING VERIFICATION ===");
  console.log(`Found ${pricing.length} pricing records.`);
  pricing.forEach(p => {
    console.log(`- [${p.category.toUpperCase()}] ${p.name}: ₹${p.price}`);
  });
  process.exit(0);
}

checkPricing();
