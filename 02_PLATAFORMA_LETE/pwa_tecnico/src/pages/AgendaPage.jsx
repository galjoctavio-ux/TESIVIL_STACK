import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import dayjs from 'dayjs';
import MainHeader from '../components/MainHeader';
import SideMenu from '../components/SideMenu';
import DatePickerFAB from '../components/DatePickerFAB';
import DiaTimeline from '../components/DiaTimeline';
import '../AgendaStyles.css';

function AgendaPage() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [swiperInstance, setSwiperInstance] = useState(null);
  const [dias, setDias] = useState([
    dayjs().subtract(1, 'day').toDate(),
    dayjs().toDate(),
    dayjs().add(1, 'day').toDate(),
  ]);

  const handleSlideChange = (swiper) => {
    if (swiper.isEnd) {
      const ultimoDia = dias[dias.length - 1];
      setDias(prevDias => [...prevDias, dayjs(ultimoDia).add(1, 'day').toDate()]);
    }

    if (swiper.isBeginning) {
      const primerDia = dias[0];
      setDias(prevDias => [dayjs(primerDia).subtract(1, 'day').toDate(), ...prevDias]);
      swiper.slideTo(1, 0);
    }
  };

  const handleDateSelect = (date) => {
    const newSelectedDate = dayjs(date);
    const newDias = [
        newSelectedDate.subtract(1, 'day').toDate(),
        newSelectedDate.toDate(),
        newSelectedDate.add(1, 'day').toDate(),
    ];
    setDias(newDias);
    if (swiperInstance) {
        setTimeout(() => swiperInstance.slideTo(1, 0), 0);
    }
  };

  return (
    <div className='agenda-container'>
      {/* 1. El nuevo header que creaste */}
      <MainHeader onMenuToggle={() => setIsMenuOpen(true)} />

      {/* 2. El nuevo menú lateral */}
      <SideMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        logout={logout}
      />

      {/* 3. El cuerpo principal con el carrusel */}
      <div className='agenda-body'>
        <Swiper
          initialSlide={1} // Empezamos en "hoy" (índice 1)
          onSwiper={setSwiperInstance}
          onSlideChange={handleSlideChange}
        >
          {/* 4. Mapeamos el estado 'dias' */}
          {dias.map((dia, index) => (
            <SwiperSlide key={index}>
              {/* Header de la fecha (Ej: "Lunes 17 de Noviembre") */}
              <div className='dia-header'>
                <strong>{dayjs(dia).format('dddd')}</strong>
                <span style={{color: '#666'}}>{dayjs(dia).format('D [de] MMMM')}</span>
              </div>

              {/* 5. El componente que renderiza la línea de tiempo */}
              <DiaTimeline date={dia} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* 6. El botón flotante para seleccionar fecha */}
      <DatePickerFAB onDateSelect={handleDateSelect} />
    </div>
  );
}

export default AgendaPage;