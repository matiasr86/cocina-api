// api/src/db/models/RedeemedCode.js
import mongoose from 'mongoose';

const RedeemedCodeSchema = new mongoose.Schema(
  {
    code:          { type: String, required: true, unique: true, index: true },
    email:         { type: String, required: true, index: true },
    uid:           { type: String, default: null },
    odooCardId:    { type: Number, required: true, index: true },
    programName:   { type: String, default: null },
    creditsAdded:  { type: Number, default: 0 },
    odooMarkedUsed:{ type: Boolean, default: false },
    meta:          { type: Object, default: {} },
    redeemedAt:    { type: Date, default: () => new Date() },
  },
  { collection: 'redeemed_codes', timestamps: true }
);

export default mongoose.models.RedeemedCode || mongoose.model('RedeemedCode', RedeemedCodeSchema);
