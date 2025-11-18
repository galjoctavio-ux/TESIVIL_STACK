import React, { useState, useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';

const PhotoUpload = ({ onFileChange }) => {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        onFileChange(reader.result); // Pass base64 string to parent
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreview(null);
    onFileChange(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if(!preview && fileInputRef.current) {
        fileInputRef.current.click()
    }
  }

  return (
    <div
      className="relative w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-gray-500 hover:bg-gray-100 hover:border-blue-500 transition-colors"
      onClick={handleClick}
    >
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      {preview ? (
        <>
          <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md text-gray-700 hover:bg-red-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </>
      ) : (
        <div className="text-center">
          <UploadCloud size={48} className="mx-auto mb-2" />
          <p className="font-semibold">Tocar para agregar evidencia</p>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
