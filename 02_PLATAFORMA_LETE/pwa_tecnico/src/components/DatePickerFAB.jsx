import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const fabStyles = {
  position: 'fixed',
  bottom: '20px',
  left: '20px',
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '24px',
  cursor: 'pointer',
  zIndex: 100,
};

const DatePickerFAB = ({ onDateSelect }) => {
  const [startDate, setStartDate] = useState(new Date());

  const handleChange = (date) => {
    setStartDate(date);
    onDateSelect(date);
  };

  const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
    <button style={fabStyles} onClick={onClick} ref={ref}>
      📅
    </button>
  ));

  return (
    <div className="date-picker-fab-container">
      <DatePicker
        selected={startDate}
        onChange={handleChange}
        customInput={<CustomInput />}
        popperPlacement="top-start"
      />
    </div>
  );
};

export default DatePickerFAB;