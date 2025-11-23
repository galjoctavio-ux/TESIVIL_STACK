import React from 'react';

const DAYS = [
    { label: 'L', value: 1, full: 'Lunes' }, // 1 suele ser Lunes en JS (dependiendo de la lib, ajustaremos si es necesario)
    { label: 'M', value: 2, full: 'Martes' },
    { label: 'M', value: 3, full: 'Miércoles' },
    { label: 'J', value: 4, full: 'Jueves' },
    { label: 'V', value: 5, full: 'Viernes' },
    { label: 'S', value: 6, full: 'Sábado' },
    { label: 'D', value: 0, full: 'Domingo' }, // 0 es Domingo en Date.getDay() estándar
];

const DaySelector = ({ selectedDays, onChange }) => {

    const toggleDay = (dayValue) => {
        if (selectedDays.includes(dayValue)) {
            onChange(selectedDays.filter((d) => d !== dayValue));
        } else {
            onChange([...selectedDays, dayValue]);
        }
    };

    return (
        <div className="flex flex-col gap-2 mb-4">
            <label className="block text-sm font-medium text-gray-700">
                Días a bloquear (Repetir)
            </label>
            <div className="flex justify-between gap-1">
                {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                        <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
              `}
                            title={day.full}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
            <div className="text-xs text-gray-400 text-center mt-1">
                {selectedDays.length === 0
                    ? 'Toca los días que no estarás disponible'
                    : selectedDays.length === 7
                        ? 'Todos los días seleccionados'
                        : `${selectedDays.length} días seleccionados`}
            </div>
        </div>
    );
};

export default DaySelector;