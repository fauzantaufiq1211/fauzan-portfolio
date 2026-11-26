import { createClient } from "../vendor/supabase-js.js";

export const SUPABASE_URL = "https://mrxttnlcpoixnvhngvtw.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeHR0bmxjcG9peG52aG5ndnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDM2MDIsImV4cCI6MjA4MzQ3OTYwMn0.1tK-18DVOokyI_uDiqkelHmALgmgeVyI9JXwPgt5sQM";

export const STORAGE_BUCKETS = Object.freeze({
  STATIC: "static",
  PORTFOLIO_IMAGES: "portfolio-images",
});

// The live Supabase contact table is named "messages", not "contact_messages".
export const DB_TABLES = Object.freeze({
  PORTFOLIO_SECTIONS: "portfolio_sections",
  PORTFOLIO_ITEMS: "portfolio_items",
  EXPERIENCE: "experience",
  EDUCATION: "education",
  COMPETENCIES: "competencies",
  MESSAGES: "messages",
});

// Local static assets avoid Supabase Storage egress for high-frequency page loads.
export const STATIC_ASSETS = Object.freeze({
  LOGO_BLACK: "/images/logo-original.svg",
  LOGO_WHITE: "/images/logo-white.svg",
  PORTRAIT: "/images/profile-fauzan-cutout.webp",
  RESUME_PDF: "/files/cv-fauzan-taufiq.pdf",
});

export function getPublicStorageUrl(bucket, objectPath) {
  if (!bucket || !objectPath) return "";
  const cleanPath = String(objectPath).replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseClient = supabase;
export default supabase;
