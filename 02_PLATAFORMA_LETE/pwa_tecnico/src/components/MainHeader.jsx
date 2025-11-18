import React from 'react';

const headerStyles = {
  backgroundColor: '#FFFFFF',
  padding: '16px',
  display: 'flex',
  alignItems: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const menuButtonStyles = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '24px',
  marginRight: '16px',
};

const titleStyles = {
  fontSize: '20px',
  fontWeight: 'bold',
  margin: 0,
};

const MainHeader = ({ onMenuToggle }) => {
  return (
    <header style={headerStyles}>
      <button onClick={onMenuToggle} style={menuButtonStyles}>
        ☰
      </button>
      <h1 style={titleStyles}>Agenda</h1>
    </header>
  );
};

export default MainHeader;