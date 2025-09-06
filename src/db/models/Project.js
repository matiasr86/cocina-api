// src/models/Project.js
import mongoose from 'mongoose';

const ModuleSchema = new mongoose.Schema({
  id: String,
  type: String,
  title: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  adjPct: Number,
  src: String,
  color: String,
}, { _id: false });

const WallSchema = new mongoose.Schema({
  id: String,
  name: String,
  width: Number,   // en metros (como en tu UI)
  height: Number,  // en metros
  modules: [ModuleSchema], // opcional si los guardás “embebidos”
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
  userId: { type: String, index: true, required: true }, // Firebase UID
  title:  { type: String, required: true },

  // Estado del diseño (flexible para que no te limite)
  kitchenType: { type: String, default: 'Recta' },
  walls: [WallSchema],                  // si preferís array de paredes
  modulesByWall: mongoose.Schema.Types.Mixed, // o map { wallId: Module[] }

  // Metadatos opcionales
  quality:   { type: String, enum: ['started','premium','deluxe'], default: 'started' },
  summary:   mongoose.Schema.Types.Mixed,
  breakdown: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

export const Project = mongoose.model('Project', ProjectSchema);
