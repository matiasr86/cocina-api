// api/src/models/Fabricator.js
import mongoose from 'mongoose';

const GeoSchema = new mongoose.Schema(
  { lat: Number, lng: Number },
  { _id: false }
);

const FabricatorSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    province: { type: String, default: '', trim: true },
    city:     { type: String, default: '', trim: true },
    zip:      { type: String, default: '', trim: true },   // opcional
    address:  { type: String, default: '', trim: true },
    phone:    { type: String, default: '', trim: true },
    website:  { type: String, default: '', trim: true },
    email:    { type: String, default: '', trim: true },
    geo:      { type: GeoSchema, default: () => ({}) },

    // Estados
    approved: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false }, // <— nuevo

    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Búsquedas comunes
FabricatorSchema.index({ approved: 1, rejected: 1, province: 1, city: 1, name: 1 });

export const Fabricator = mongoose.model('Fabricator', FabricatorSchema);
