import React from 'react';

const InputCard = ({ label, icon, children, error }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-4">
      <label className="block text-md font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center bg-gray-50 rounded-lg p-2 border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {icon && <span className="text-gray-400 mr-3">{icon}</span>}
        {children}
      </div>
       {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default InputCard;
