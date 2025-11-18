import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';

const PhotoUpload = ({ onFileChange }) => {
  const [preview, setPreview] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        if (onFileChange) {
          onFileChange(reader.result); // Pass base64 string
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (onFileChange) {
      onFileChange(null);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label
        style={{
          display: 'flex',
          width: '100%',
          aspectRatio: '1 / 1', // Square
          border: '2px dashed #D1D5DB',
          borderRadius: '8px',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: preview ? `url(${preview})` : '#F9FAFB',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          color: preview ? 'transparent' : '#6B7280',
        }}
      >
        {!preview && (
          <>
            <Upload size={48} />
            <span style={{ marginTop: '8px', fontWeight: '500' }}>Tocar para agregar evidencia</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </label>
      {preview && (
        <button
          type="button"
          onClick={handleRemove}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
};

export default PhotoUpload;