import mongoose from 'mongoose';

const SizeSchema = new mongoose.Schema(
  {
    width:      { type: Number, required: true },
    height:     { type: Number, required: true },
    isStandard: { type: Boolean, default: false }, // NUEVO
    deltaPct:   { type: Number,  default: 0 },     // NUEVO
  },
  { _id: false }
);

const PricesSchema = new mongoose.Schema(
  { started: Number, premium: Number, deluxe: Number },
  { _id: false }
);

const OverrideSchema = new mongoose.Schema(
  {
    type:    { type: String, required: true, unique: true, index: true },
    name:    { type: String, default: null },
    subtitle: { type: String, default: null }, 
    visible: { type: Boolean, default: true },
    sizes:   { type: [SizeSchema], default: [] },      // ahora incluye isStandard + deltaPct
    prices:  { type: PricesSchema, default: () => ({}) }
  },
  { timestamps: true, versionKey: false }
);

export const Override = mongoose.model('Override', OverrideSchema);
