import React from 'react';
import { Mail } from 'lucide-react';

const Input = ({ icon, ...props }) => {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
      {icon && <span style={{ position: 'absolute', left: '12px', color: '#9CA3AF' }}>{icon}</span>}
      <input
        {...props}
        style={{
          width: '100%',
          padding: `12px ${icon ? '12px 12px 40px' : '12px'}`,
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          fontSize: '1rem',
          color: '#111827',
          backgroundColor: '#F9FAFB',
          boxSizing: 'border-box', // Ensure padding doesn't add to width
        }}
      />
    </div>
  );
};

export default Input;