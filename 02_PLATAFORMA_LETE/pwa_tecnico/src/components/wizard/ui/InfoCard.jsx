
import React from 'react';

const InfoCard = ({ children }) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200">
      {children}
    </div>
  );
};

export default InfoCard;
