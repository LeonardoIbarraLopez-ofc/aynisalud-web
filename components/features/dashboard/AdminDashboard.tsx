import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../common/Card';
import { Spinner } from '../../common/Spinner';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from 'recharts';
import { type AppointmentAnalyticsPayload } from '../../../types';

type RangeOption = {
    label: string;
    days: number;
};

const RANGE_OPTIONS: RangeOption[] = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Últimos 90 días', days: 90 },
];

const STATUS_LABELS: Record<string, string> = {
    pending_confirmation: 'Pendiente',
    confirmed: 'Confirmada',
    checked_in: 'En espera',
    in_progress: 'En consulta',
    attended_pending_payment: 'Por cobrar',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No asistió',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

// Mock data for demonstration
const MOCK_ANALYTICS: AppointmentAnalyticsPayload = {
    range: {
        startDate: '2024-11-06',
        endDate: '2024-12-05',
        days: 30,
    },
    summary: {
        total: 245,
        confirmed: 189,
        completed: 156,
        cancelled: 23,
        noShow: 12,
    },
    dailySeries: [
        { date: '2024-11-06', total: 8, confirmed: 6, completed: 6, cancelled: 1, noShow: 0 },
        { date: '2024-11-07', total: 12, confirmed: 10, completed: 10, cancelled: 2, noShow: 0 },
        { date: '2024-11-08', total: 15, confirmed: 13, completed: 12, cancelled: 1, noShow: 1 },
        { date: '2024-11-09', total: 10, confirmed: 8, completed: 8, cancelled: 1, noShow: 0 },
        { date: '2024-11-10', total: 18, confirmed: 15, completed: 14, cancelled: 2, noShow: 1 },
        { date: '2024-11-11', total: 14, confirmed: 12, completed: 11, cancelled: 1, noShow: 1 },
        { date: '2024-11-12', total: 16, confirmed: 14, completed: 13, cancelled: 2, noShow: 0 },
        { date: '2024-11-13', total: 9, confirmed: 8, completed: 7, cancelled: 1, noShow: 0 },
        { date: '2024-11-14', total: 20, confirmed: 17, completed: 16, cancelled: 3, noShow: 1 },
        { date: '2024-11-15', total: 17, confirmed: 15, completed: 14, cancelled: 2, noShow: 0 },
        { date: '2024-11-16', total: 13, confirmed: 11, completed: 10, cancelled: 1, noShow: 1 },
        { date: '2024-11-17', total: 19, confirmed: 16, completed: 15, cancelled: 2, noShow: 1 },
        { date: '2024-11-18', total: 11, confirmed: 9, completed: 9, cancelled: 1, noShow: 0 },
        { date: '2024-11-19', total: 22, confirmed: 19, completed: 18, cancelled: 3, noShow: 1 },
        { date: '2024-11-20', total: 15, confirmed: 13, completed: 12, cancelled: 2, noShow: 0 },
        { date: '2024-11-21', total: 18, confirmed: 15, completed: 14, cancelled: 2, noShow: 1 },
        { date: '2024-11-22', total: 12, confirmed: 10, completed: 10, cancelled: 1, noShow: 0 },
        { date: '2024-11-23', total: 21, confirmed: 18, completed: 17, cancelled: 3, noShow: 1 },
        { date: '2024-11-24', total: 16, confirmed: 14, completed: 13, cancelled: 2, noShow: 0 },
        { date: '2024-11-25', total: 14, confirmed: 12, completed: 11, cancelled: 1, noShow: 1 },
        { date: '2024-11-26', total: 19, confirmed: 16, completed: 15, cancelled: 2, noShow: 1 },
        { date: '2024-11-27', total: 10, confirmed: 8, completed: 8, cancelled: 1, noShow: 0 },
        { date: '2024-11-28', total: 23, confirmed: 20, completed: 19, cancelled: 3, noShow: 1 },
        { date: '2024-11-29', total: 17, confirmed: 15, completed: 14, cancelled: 2, noShow: 0 },
        { date: '2024-11-30', total: 20, confirmed: 17, completed: 16, cancelled: 2, noShow: 1 },
        { date: '2024-12-01', total: 15, confirmed: 13, completed: 12, cancelled: 1, noShow: 1 },
        { date: '2024-12-02', total: 18, confirmed: 15, completed: 14, cancelled: 2, noShow: 1 },
        { date: '2024-12-03', total: 13, confirmed: 11, completed: 10, cancelled: 1, noShow: 1 },
        { date: '2024-12-04', total: 21, confirmed: 18, completed: 17, cancelled: 3, noShow: 1 },
        { date: '2024-12-05', total: 16, confirmed: 14, completed: 13, cancelled: 2, noShow: 0 },
    ],
    typeDistribution: [
        { typeId: '1', typeName: 'Consulta General', count: 85 },
        { typeId: '2', typeName: 'Especialista', count: 62 },
        { typeId: '3', typeName: 'Control', count: 45 },
        { typeId: '4', typeName: 'Emergencia', count: 28 },
        { typeId: '5', typeName: 'Vacunación', count: 25 },
    ],
    statusDistribution: [
        { status: 'completed', count: 156 },
        { status: 'confirmed', count: 33 },
        { status: 'pending_confirmation', count: 23 },
        { status: 'cancelled', count: 23 },
        { status: 'no_show', count: 12 },
        { status: 'checked_in', count: 8 },
        { status: 'in_progress', count: 5 },
        { status: 'attended_pending_payment', count: 3 },
    ],
    topProviders: [
        { doctorId: '1', doctorName: 'Dr. María González', count: 45 },
        { doctorId: '2', doctorName: 'Dr. Carlos Rodríguez', count: 38 },
        { doctorId: '3', doctorName: 'Dra. Ana López', count: 32 },
        { doctorId: '4', doctorName: 'Dr. Juan Martínez', count: 28 },
        { doctorId: '5', doctorName: 'Dra. Laura Sánchez', count: 25 },
    ],
};

const AdminDashboard: React.FC = () => {
    const [selectedRange, setSelectedRange] = useState<RangeOption>(RANGE_OPTIONS[1]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<AppointmentAnalyticsPayload | null>(null);

    const loadAnalytics = useCallback(async (range: RangeOption) => {
        setIsLoading(true);
        setError(null);
        try {
            // Simulate API delay for realistic loading experience
            await new Promise(resolve => setTimeout(resolve, 500));
            setAnalytics(MOCK_ANALYTICS);
        } catch (err) {
            console.error('[AdminDashboard] analytics fetch failed', err);
            setError('No se pudieron cargar las métricas. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAnalytics(selectedRange);
    }, [loadAnalytics, selectedRange]);

    const summaryCards = useMemo(() => {
        if (!analytics) return [];
        const { summary } = analytics;
        return [
            { label: 'Citas totales', value: summary.total },
            { label: 'Confirmadas', value: summary.confirmed },
            { label: 'Completadas', value: summary.completed },
            { label: 'Canceladas', value: summary.cancelled },
            { label: 'No asistieron', value: summary.noShow },
        ];
    }, [analytics]);

    const dailySeries = analytics?.dailySeries ?? [];
    const typeDistribution = analytics?.typeDistribution ?? [];
    const statusDistribution = analytics?.statusDistribution ?? [];
    const topProviders = analytics?.topProviders ?? [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Panel Administrativo</h1>
                    <p className="text-gray-600">Métricas y tendencias de citas por clínica.</p>
                </div>
                <div className="flex space-x-2">
                    {RANGE_OPTIONS.map(option => (
                        <button
                            key={option.days}
                            onClick={() => setSelectedRange(option)}
                            className={`px-4 py-2 rounded-md text-sm font-semibold border transition-colors ${
                                option.days === selectedRange.days
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Spinner />
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            ) : !analytics ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                    No hay datos disponibles para el rango seleccionado.
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {summaryCards.map(card => (
                            <div key={card.label} className="bg-white rounded-lg shadow p-4">
                                <p className="text-sm text-gray-500">{card.label}</p>
                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card title="Citas por día">
                            {dailySeries.length === 0 ? (
                                <p className="text-gray-500 text-sm">No hay datos en el período seleccionado.</p>
                            ) : (
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={dailySeries} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} />
                                            <Line type="monotone" dataKey="confirmed" name="Confirmadas" stroke="#6366f1" strokeWidth={2} />
                                            <Line type="monotone" dataKey="completed" name="Completadas" stroke="#10b981" strokeWidth={2} />
                                            <Line type="monotone" dataKey="cancelled" name="Canceladas" stroke="#ef4444" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        <Card title="Distribución por tipo de cita">
                            {typeDistribution.length === 0 ? (
                                <p className="text-gray-500 text-sm">No hay datos de tipo de cita para el período.</p>
                            ) : (
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={typeDistribution}
                                                dataKey="count"
                                                nameKey="typeName"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={110}
                                                label={({ typeName, percent }) => `${typeName} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {typeDistribution.map((entry, index) => (
                                                    <Cell key={entry.typeId || index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card title="Estado de las citas">
                            {statusDistribution.length === 0 ? (
                                <p className="text-gray-500 text-sm">No se encontraron estados registrados.</p>
                            ) : (
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={statusDistribution} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="status"
                                                tick={{ fontSize: 12 }}
                                                tickFormatter={value => STATUS_LABELS[value] || value}
                                            />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip formatter={(value: number, name: string) => [value, STATUS_LABELS[name] || name]} />
                                            <Bar dataKey="count" fill="#6366f1" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        <Card title="Profesionales con más citas">
                            {topProviders.length === 0 ? (
                                <p className="text-gray-500 text-sm">No hay actividad registrada de profesionales.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {topProviders.map((provider, index) => (
                                        <li key={provider.doctorId || index} className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-800">{provider.doctorName || 'Sin nombre'}</p>
                                                <p className="text-xs text-gray-500">{provider.count} citas</p>
                                            </div>
                                            <span className="text-sm font-semibold text-indigo-600">#{index + 1}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
