import mongoose from 'mongoose';

const SizeSchema = new mongoose.Schema(
  {
    width:  { type: Number, required: true },  // cm (o px si preferís)
    height: { type: Number, required: true }
  },
  { _id: false }
);

const PricesSchema = new mongoose.Schema(
  {
    started: { type: Number, default: null },
    premium: { type: Number, default: null },
    deluxe:  { type: Number, default: null }
  },
  { _id: false }
);

const OverrideSchema = new mongoose.Schema(
  {
    type:    { type: String, required: true, unique: true, index: true },
    visible: { type: Boolean, default: true },
    sizes:   { type: [SizeSchema], default: [] },
    prices:  { type: PricesSchema, default: () => ({}) }
  },
  { timestamps: true, versionKey: false }
);

export const Override = mongoose.model('Override', OverrideSchema);
