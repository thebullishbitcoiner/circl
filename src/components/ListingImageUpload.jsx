import { useRef, useState } from "react";
import { uploadFile } from "../utils/upload.js";

export default function ListingImageUpload({ images, onChange, myPubkey, blossomServers = [] }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    setUploadErr("");
    const uploaded = [];
    const errors = [];
    for (const file of files) {
      try {
        uploaded.push(await uploadFile(file, { blossomServers, myPubkey }));
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (uploaded.length) onChange([...images, ...uploaded]);
    if (errors.length) setUploadErr(`Upload failed — ${errors[0]}`);
    setUploading(false);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
    e.target.value = "";
  };

  return (
    <div>
      {images.length > 0 && (
        <div className="compose-previews" style={{ padding: 0, marginBottom: 8 }}>
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="compose-preview">
              <img src={url} alt="" style={{ height: 90, width: "auto", maxWidth: 160, objectFit: "cover" }} />
              <button type="button" className="compose-preview-remove" onClick={() => onChange(images.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
        <button
          type="button"
          className="compose-media-btn"
          title="Upload image"
          onClick={() => fileRef.current?.click()}
          style={{ width: "auto", height: 34, borderRadius: 8, padding: "0 12px", border: "1px dashed var(--border)", fontSize: 13, gap: 6 }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          Add image
        </button>
        {uploading && <span className="compose-upload-status" style={{ padding: 0 }}>Uploading…</span>}
      </div>
      {uploadErr && <div className="compose-upload-status" style={{ padding: "4px 0 0", color: "#E05C8A" }}>{uploadErr}</div>}
    </div>
  );
}
