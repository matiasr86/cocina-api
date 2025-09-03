// src/utils/firebaseAdmin.js
import admin from 'firebase-admin';

/**
 * Inicializa Firebase Admin en uno de dos modos:
 *  A) CERT (preferido): FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *  B) ADC (fallback):   GOOGLE_APPLICATION_CREDENTIALS o ADC del entorno
 *     — y en ambos casos nos aseguramos de setear projectId.
 */
let inited = false;

export function ensureFirebaseAdmin() {
  if (inited && admin.apps.length) return admin;

  // Detectá el projectId de forma robusta
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    '';

  const hasCertVars =
    !!projectId &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (hasCertVars) {
      // Limpieza defensiva de la clave: quita comillas envolventes y restaura \n
      let pk = process.env.FIREBASE_PRIVATE_KEY.trim();
      if (
        (pk.startsWith('"') && pk.endsWith('"')) ||
        (pk.startsWith("'") && pk.endsWith("'")) ||
        (pk.startsWith('“') && pk.endsWith('”')) ||
        (pk.startsWith('‘') && pk.endsWith('’')) ||
        (pk.startsWith('`') && pk.endsWith('`'))
      ) {
        pk = pk.slice(1, -1);
      }
      pk = pk.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pk,
        }),
        projectId, // explícito por si la lib lo necesita
      });
      console.log('[firebaseAdmin] init → CERT mode, projectId:', projectId);
    } else {
      // Fallback a ADC pero con projectId explícito (evita "Unable to detect a Project Id")
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      console.log('[firebaseAdmin] init → ADC mode, projectId:', projectId || '(none)');
    }

    inited = true;
    return admin;
  } catch (err) {
    console.error('[firebaseAdmin] init error:', err);
    throw err;
  }
}

export const firebaseAdmin = ensureFirebaseAdmin();
