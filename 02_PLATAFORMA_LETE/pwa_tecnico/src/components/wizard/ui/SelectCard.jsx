
import React from 'react';

const SelectCard = ({ label, name, value, onChange, options }) => {
  return (
    <div className="bg-white shadow-md rounded-xl p-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-3 bg-gray-50 border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectCard;
