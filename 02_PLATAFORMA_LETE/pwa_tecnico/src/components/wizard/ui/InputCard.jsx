import React from 'react';
import { cn } from '../../../utils/cn.js';

const InputCard = ({ label, id, error, className, ...props }) => {
  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-600 mb-1">
        {label}
      </label>
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <input
          id={id}
          className="w-full bg-gray-100 text-gray-800 placeholder-gray-400 rounded-md py-3 px-4 border-none focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
          {...props}
        />
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-red-500">
          {error}
        </p>
      )}
    </div>
  );
};

export default InputCard;