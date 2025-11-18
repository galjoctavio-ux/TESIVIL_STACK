import React from 'react';

const InfoCard = ({ title, children }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="text-gray-600">
        {children}
      </div>
    </div>
  );
};

export default InfoCard;
