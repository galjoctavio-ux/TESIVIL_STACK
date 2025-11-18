import React from 'react';
import { Camera, X } from 'lucide-react';
import { cn } from '../../../utils/cn.js';

const PhotoUpload = ({ photo, onUpload, onClear, label }) => {
  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearPhoto = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClear();
  }

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-600 mb-2">{label}</label>}
      <div
        className={cn(
          "relative w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
          photo
            ? "border-transparent bg-gray-200"
            : "border-blue-300 bg-blue-50 hover:bg-blue-100"
        )}
        onClick={() => document.getElementById('photo-upload-input').click()}
      >
        <input
          type="file"
          id="photo-upload-input"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {photo ? (
          <>
            <img src={photo} alt="Uploaded" className="w-full h-full object-cover rounded-xl" />
            <button
              type="button"
              onClick={handleClearPhoto}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              aria-label="Eliminar foto"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="text-center text-blue-500">
            <Camera size={48} className="mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-sm">Tocar para subir foto</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoUpload;