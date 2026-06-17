// CloudinaryService.js — reusable Cloudinary upload operations
// Uses unsigned uploads via an upload preset (no backend needed)
// Set up your upload preset in Cloudinary Console:
//   Settings → Upload → Upload Presets → Add unsigned preset
//   Set "Folder" to "ojt_verifications" if you want auto-organization

// ── Config — replace with your actual Cloudinary values ──────────────────────
const CLOUDINARY_CLOUD_NAME    = "doalndt5l";     // e.g. "dxyz123abc"
const CLOUDINARY_UPLOAD_PRESET = "ojtern_docs";  // e.g. "ojt_unsigned"

// ─────────────────────────────────────────────────────────────────────────────
// Upload a single file (PDF or image) to Cloudinary
// Returns the secure_url string of the uploaded file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads one file to Cloudinary.
 * @param {File} file — a File object (PDF or PNG)
 * @returns {Promise<string>} the Cloudinary secure_url
 * @throws Error with a descriptive message if upload fails
 */
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file",           file);
  formData.append("upload_preset",  CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder",         "ojt_verifications");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Cloudinary upload failed for "${file.name}"`
    );
  }

  const data = await res.json();
  return data.secure_url;
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload multiple files — returns array of secure_urls in the same order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads multiple files to Cloudinary in parallel.
 * @param {File[]} files — array of File objects
 * @returns {Promise<string[]>} array of Cloudinary secure_urls
 */
export const uploadFiles = async (files) => {
  return Promise.all(files.map(uploadFile));
};