import React from 'react';

const BigToggle = ({ value, onChange, label }) => {
  const handleToggle = (newValue) => {
    if (onChange) {
      onChange({ target: { name: 'big-toggle', value: newValue } });
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #007BFF' }}>
        <button
          type="button"
          onClick={() => handleToggle(false)}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            background: !value ? '#007BFF' : '#FFFFFF',
            color: !value ? '#FFFFFF' : '#007BFF',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          NO
        </button>
        <button
          type="button"
          onClick={() => handleToggle(true)}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            background: value ? '#007BFF' : '#FFFFFF',
            color: value ? '#FFFFFF' : '#007BFF',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          SÍ
        </button>
      </div>
    </div>
  );
};

export default BigToggle;