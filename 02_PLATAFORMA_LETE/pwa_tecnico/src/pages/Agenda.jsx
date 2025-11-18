import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import MainHeader from '../components/MainHeader';
import SideMenu from '../components/SideMenu';
import DatePickerFAB from '../components/DatePickerFAB';
import DiaTimeline from '../components/DiaTimeline';

const Agenda = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleDateSelect = (newDate) => {
    setSelectedDate(newDate);
  };

  return (
    <div>
      <MainHeader onMenuToggle={handleMenuToggle} />
      <SideMenu
        isOpen={isMenuOpen}
        onClose={handleCloseMenu}
        user={user}
        logout={logout}
      />
      <DiaTimeline date={selectedDate} />
      <DatePickerFAB onDateSelect={handleDateSelect} />
    </div>
  );
};

export default Agenda;
