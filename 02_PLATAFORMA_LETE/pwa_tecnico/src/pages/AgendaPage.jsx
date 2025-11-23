import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import dayjs from 'dayjs';
import 'dayjs/locale/es-mx';

// Componentes existentes
import MainHeader from '../components/MainHeader';
import SideMenu from '../components/SideMenu';
import DatePickerFAB from '../components/DatePickerFAB';
import DiaTimeline from '../components/DiaTimeline';

// NUEVO COMPONENTE (Asegúrate de haber creado el archivo AvailabilityModal.jsx)
import AvailabilityModal from '../components/AvailabilityModal';

import '../AgendaStyles.css';

dayjs.locale('es-mx');

function AgendaPage() {
  const { user, logout } = useAuth();

  // Estados para controlar Menú y Modal
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAvailModalOpen, setIsAvailModalOpen] = useState(false);

  const [swiperInstance, setSwiperInstance] = useState(null);
  const [dias, setDias] = useState([
    dayjs().subtract(1, 'day').toDate(),
    dayjs().toDate(),
    dayjs().add(1, 'day').toDate(),
  ]);

  // Manejador del Swiper (Carrusel de días)
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

  // Manejador del selector de fecha flotante
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

  // Función puente: Cierra menú -> Abre Modal
  const handleOpenAvailability = () => {
    setIsMenuOpen(false); // 1. Cierra el menú lateral
    setTimeout(() => {
      setIsAvailModalOpen(true); // 2. Abre el modal (pequeño delay para suavidad visual)
    }, 150);
  };

  return (
    <div className='agenda-container'>
      {/* HEADER */}
      <MainHeader onMenuToggle={() => setIsMenuOpen(true)} />

      {/* MENÚ LATERAL */}
      <SideMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        logout={logout}
        onOpenAvailability={handleOpenAvailability} // Pasamos la función
      />

      {/* CUERPO PRINCIPAL (SWIPER) */}
      <div className='agenda-body'>
        <Swiper
          initialSlide={1}
          onSwiper={setSwiperInstance}
          onSlideChange={handleSlideChange}
        >
          {dias.map((dia, index) => (
            <SwiperSlide key={index}>
              <div className='dia-header'>
                <strong>
                  {dayjs(dia).format('dddd').charAt(0).toUpperCase() + dayjs(dia).format('dddd').slice(1)}
                </strong>
                <span style={{ color: '#666' }}>
                  {dayjs(dia).format('D [de] MMMM')}
                </span>
              </div>
              <DiaTimeline date={dia} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* BOTÓN FLOTANTE CALENDARIO */}
      <DatePickerFAB onDateSelect={handleDateSelect} />

      {/* MODAL DE DISPONIBILIDAD (Solo se renderiza si está activo) */}
      {isAvailModalOpen && (
        <AvailabilityModal
          onClose={() => setIsAvailModalOpen(false)}
        />
      )}
    </div>
  );
}

export default AgendaPage;