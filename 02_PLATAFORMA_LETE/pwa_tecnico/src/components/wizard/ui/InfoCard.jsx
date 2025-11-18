import React from 'react';

const InfoCard = ({ title, data }) => {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#F3F4F6',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#111827', fontSize: '1.1rem' }}>{title}</h3>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#6B7280' }}>{key}:</span>
          <span style={{ fontWeight: '500', color: '#111827' }}>{value}</span>
        </div>
      ))}
    </div>
  );
};

export default InfoCard;