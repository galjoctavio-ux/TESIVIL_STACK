import React, { useState } from 'react';

const BigToggle = ({ label, onChange }) => {
  const [isOn, setIsOn] = useState(false);

  const handleToggle = (value) => {
    setIsOn(value);
    onChange(value);
  };

  return (
    <div className="my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <p className="block text-md font-medium text-gray-700 mb-3">{label}</p>
      <div className="flex w-full">
        <button
          onClick={() => handleToggle(true)}
          className={`flex-1 py-3 text-lg font-bold rounded-l-lg transition-colors ${isOn ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          SÍ
        </button>
        <button
          onClick={() => handleToggle(false)}
          className={`flex-1 py-3 text-lg font-bold rounded-r-lg transition-colors ${!isOn ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          NO
        </button>
      </div>
    </div>
  );
};

export default BigToggle;
