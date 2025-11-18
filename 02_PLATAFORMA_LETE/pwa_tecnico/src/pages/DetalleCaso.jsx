import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCasoById, cerrarCasoManualmente } from '../apiService';

const DetalleCaso = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caso, setCaso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCaso = async () => {
            try {
                setLoading(true);
                const data = await getCasoById(id);
                setCaso(data);
                setError(null);
            } catch (err) {
                setError('Error al cargar el caso');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchCaso();
    }, [id]);

    const handleCerrarCaso = async () => {
        if (window.confirm('¿Estás seguro de que quieres cerrar este caso manualmente?')) {
            try {
                await cerrarCasoManualmente(id);
                alert('Caso cerrado exitosamente');
                navigate('/agenda'); // O recargar datos
            } catch (err) {
                setError('Error al cerrar el caso');
                console.error(err);
            }
        }
    };

    const openGoogleMaps = (address) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };


    if (loading) return <div className="p-4">Cargando...</div>;
    if (error) return <div className="p-4 text-red-500">{error}</div>;
    if (!caso) return <div className="p-4">No se encontró el caso.</div>;

    const statusBadgeClass = caso.status === 'completado' ? 'bg-green-500' : 'bg-yellow-500';

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <header className="flex items-center justify-between mb-4">
                <button onClick={() => navigate(-1)} className="text-xl">
                    &#x2190; {/* Left arrow */}
                </button>
                <h1 className="text-xl font-bold">Detalle del Caso</h1>
                <span className={`px-3 py-1 text-white rounded-full text-sm ${statusBadgeClass}`}>
                    {caso.status}
                </span>
            </header>

            <div className="card bg-white p-4 rounded-lg shadow mb-4">
                <h2 className="font-bold text-lg mb-2">Cliente</h2>
                <p>{caso.cliente_nombre}</p>
                <p className="text-gray-600">{caso.cliente_direccion}</p>
                <button
                    onClick={() => openGoogleMaps(caso.cliente_direccion)}
                    className="mt-2 text-blue-500 font-semibold flex items-center"
                >
                    📍 Ver en Mapa
                </button>
            </div>

            <div className="card bg-white p-4 rounded-lg shadow mb-4">
                <h2 className="font-bold text-lg mb-2">Detalles del Trabajo</h2>
                <div>
                    <h3 className="font-semibold">Comentarios Iniciales:</h3>
                    <p className="text-gray-700">{caso.comentarios_iniciales}</p>
                </div>
                <div className="mt-2">
                    <h3 className="font-semibold">Tipo de Trabajo:</h3>
                    <p className="text-gray-700">{caso.tipo}</p>
                </div>
            </div>

            {caso.status !== 'completado' && (
                <div className="mt-6">
                    <button
                        onClick={handleCerrarCaso}
                        className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-blue-600"
                    >
                        Cerrar Caso Manualmente
                    </button>
                </div>
            )}
        </div>
    );
};

export default DetalleCaso;