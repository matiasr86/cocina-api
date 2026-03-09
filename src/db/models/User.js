import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    // 🔑 Identificador único del usuario
    email: { type: String, lowercase: true, trim: true, index: true, unique: true, sparse: true },

    // (opcional) guardamos uid de Firebase para trazabilidad
    uid:     { type: String, index: true },
    lastUid: { type: String },

    // Créditos y flags
    credits: { type: Number, default: 0 },
    welcomeCreditGranted: { type: Boolean, default: false },
    // ✅ NUEVO: marca si alguna vez canjeó/compró créditos
    hasPurchasedCredits: { type: Boolean, default: false },

    // Locks/cooldown para render
    inflightRender:     { type: Boolean, default: false },
    inflightLockUntil:  { type: Date, default: null },
    cooldownUntil:      { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
