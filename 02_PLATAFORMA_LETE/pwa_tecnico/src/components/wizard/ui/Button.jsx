import React from 'react';

const Button = ({ children, onClick, variant = 'solid', disabled = false, fullWidth = false, type = 'button' }) => {
  const baseStyle = {
    padding: '14px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.2s, color 0.2s',
    width: fullWidth ? '100%' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const solidStyle = {
    backgroundColor: disabled ? '#A5B4FC' : '#4F46E5',
    color: 'white',
  };

  const outlineStyle = {
    backgroundColor: 'transparent',
    color: disabled ? '#D1D5DB' : '#6B7280',
    border: `2px solid ${disabled ? '#D1D5DB' : '#6B7280'}`,
  };

  const style = {
    ...baseStyle,
    ...(variant === 'solid' ? solidStyle : outlineStyle),
  };

  return (
    <button style={style} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
};

export default Button;