
import React from 'react';

const InputCard = ({
  label,
  name,
  value,
  onChange,
  unit,
  placeholder,
  type = 'text',
  isTextarea = false,
}) => {
  const commonProps = {
    id: name,
    name,
    value,
    onChange,
    placeholder,
    className: 'w-full p-3 bg-gray-50 border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500',
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        {isTextarea ? (
          <textarea {...commonProps} rows="4" />
        ) : (
          <input {...commonProps} type={type} />
        )}
        {unit && (
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

export default InputCard;
