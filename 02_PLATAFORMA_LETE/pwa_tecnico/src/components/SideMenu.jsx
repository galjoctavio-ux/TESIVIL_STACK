import React from 'react';

const backdropStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 999,
  transition: 'opacity 0.3s ease-in-out',
};

const menuStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '280px',
  height: '100%',
  backgroundColor: 'white',
  zIndex: 1000,
  transform: 'translateX(-100%)',
  transition: 'transform 0.3s ease-in-out',
  padding: '20px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
};

const activeMenuStyles = {
  transform: 'translateX(0)',
};

const activeBackdropStyles = {
  opacity: 1,
};

const inactiveBackdropStyles = {
    opacity: 0,
    pointerEvents: 'none',
  };

const userInfoStyles = {
  marginBottom: 'auto',
  fontSize: '1.1rem',
  fontWeight: 'bold',
};

const logoutButtonStyles = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '20px',
};

const SideMenu = ({ isOpen, onClose, user, logout }) => {
  return (
    <>
      <div
        style={{
          ...backdropStyles,
          ...(isOpen ? activeBackdropStyles : inactiveBackdropStyles),
        }}
        onClick={onClose}
      />
      <div
        style={{
          ...menuStyles,
          ...(isOpen ? activeMenuStyles : {}),
        }}
      >
        <div style={userInfoStyles}>
          <p>Hola, {user?.nombre}</p>
        </div>
        <button style={logoutButtonStyles} onClick={logout}>
          Salir
        </button>
      </div>
    </>
  );
};

export default SideMenu;