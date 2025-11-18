import React from 'react';
import { cn } from '../../../utils/cn.js';

const BigToggle = ({ label, value, onChange, options = [{ label: 'No', value: false }, { label: 'Sí', value: true }] }) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-600 mb-2">
        {label}
      </label>
      <div className="flex items-center bg-gray-100 rounded-xl p-1.5" style={{ minHeight: '50px' }}>
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "w-1/2 h-full rounded-lg text-sm font-bold transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                isActive
                  ? "bg-white shadow-md text-blue-600"
                  : "bg-transparent text-gray-500 hover:bg-gray-200"
              )}
              style={{ minHeight: '44px' }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BigToggle;