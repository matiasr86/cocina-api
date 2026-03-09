import mongoose from 'mongoose';

const WelcomeMonthlyQuotaSchema = new mongoose.Schema(
  {
    // Ej: "2026-03"
    monthKey: { type: String, required: true, unique: true },
    // cantidad de renders gratuitos consumidos globalmente en ese mes
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.WelcomeMonthlyQuota ||
  mongoose.model('WelcomeMonthlyQuota', WelcomeMonthlyQuotaSchema);