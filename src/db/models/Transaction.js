import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true, index: true },
    uid:   { type: String, index: true },

    // ← ampliamos enum para tolerar tus tipos actuales
    type: {
      type: String,
      enum: ['render', 'render_triad', 'render_single', 'redeem', 'adjust'],
      required: true,
    },
    creditsDelta: { type: Number, required: true },

    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
