import React, { useEffect, useMemo, useState } from 'react';
import { fetchAppointmentsForPatient } from '../../../api/appointments';
import { getPatientPortalOverview } from '../../../api/patientPortal';
import { useAuth } from '../../../contexts/AuthContext';
import { type Appointment } from '../../../types';

// Small util: build matrix for a month (weeks x days)
const buildMonthMatrix = (year: number, month: number) => {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstWeekday = firstDayOfMonth.getDay(); // 0..6 (Sun..Sat)

  const daysInMonth = lastDayOfMonth.getDate();
  const matrix: number[][] = [];
  let week: number[] = [];
  // pad beginning
  for (let i = 0; i < firstWeekday; i++) week.push(0);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      matrix.push(week);
      week = [];
    }
  }

  // pad end
  if (week.length > 0) {
    while (week.length < 7) week.push(0);
    matrix.push(week);
  }

  return matrix;
};

const weekdayShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const PatientCalendar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [displayMonth, setDisplayMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const portal = await getPatientPortalOverview();
        if (!portal?.patient?.id) {
          setAppointments([]);
          return;
        }
        const patientAppointments = await fetchAppointmentsForPatient(portal.patient.id);
        setAppointments(patientAppointments);
      } catch (err) {
        console.error('Failed fetching appointments for calendar', err);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated]);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const monthMatrix = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  // map day number to appointments
  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    appointments.forEach(a => {
      const d = new Date(a.startTime).getDate();
      const m = new Date(a.startTime).getMonth();
      const y = new Date(a.startTime).getFullYear();
      if (y === year && m === month) {
        const arr = map.get(d) || [];
        arr.push(a);
        map.set(d, arr);
      }
    });
    return map;
  }, [appointments, year, month]);

  const goPrev = () => setDisplayMonth(new Date(year, month - 1, 1));
  const goNext = () => setDisplayMonth(new Date(year, month + 1, 1));

  const handleDayClick = (d: number) => {
    if (d === 0) return;
    setSelectedDay(prev => (prev === d ? null : d));
  };

  const appointmentsForSelected = selectedDay ? appointmentsByDay.get(selectedDay) || [] : [];

  if (!isAuthenticated) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Inicie sesión para ver sus citas.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Mis Citas</h3>
          <p className="text-sm text-gray-500">{displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 rounded-md hover:bg-gray-100" onClick={goPrev} aria-label="Mes anterior">◀</button>
          <button className="px-3 py-1 rounded-md hover:bg-gray-100" onClick={() => setDisplayMonth(new Date())}>Hoy</button>
          <button className="px-3 py-1 rounded-md hover:bg-gray-100" onClick={goNext} aria-label="Mes siguiente">▶</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm">
        {weekdayShort.map(w => (
          <div key={w} className="font-medium text-gray-500 py-1">{w}</div>
        ))}

        {monthMatrix.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((d, di) => {
              const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const appts = d ? appointmentsByDay.get(d) || [] : [];
              return (
                <button key={di} onClick={() => handleDayClick(d)} className={`min-h-[64px] p-2 flex flex-col items-start text-left rounded-lg transition-colors ${d ? 'hover:bg-gray-50' : 'opacity-30'} ${isToday ? 'ring-2 ring-teal-300' : ''}`}>
                  <div className="flex items-center w-full justify-between">
                    <span className={`text-sm font-medium ${d ? 'text-gray-700' : 'text-transparent'}`}>{d || '•'}</span>
                    {appts.length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center bg-teal-600 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">{appts.length}</span>
                    )}
                  </div>
                  <div className="mt-1 w-full">
                    {appts.slice(0,2).map((a) => (
                      <div key={a.id} className="text-xs text-gray-500 truncate">{new Date(a.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {a.type.name}</div>
                    ))}
                    {appts.length > 2 && <div className="text-xs text-gray-400">+{appts.length - 2} más</div>}
                  </div>
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Modal / panel for selected day */}
      {selectedDay !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setSelectedDay(null)}></div>
          <div className="bg-white w-full sm:max-w-lg rounded-t-lg sm:rounded-lg p-4 m-4 shadow-lg z-10">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">{displayMonth.toLocaleString(undefined, { month: 'long' })} {selectedDay}, {year}</h4>
                <p className="text-sm text-gray-500">Resumen de citas</p>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedDay(null)}>✕</button>
            </div>

            <div className="mt-3">
              {appointmentsForSelected.length === 0 && <p className="text-gray-500">No hay citas en este día.</p>}
              {appointmentsForSelected.map(a => (
                <div key={a.id} className="border-b last:border-b-0 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.type.name}</div>
                      <div className="text-xs text-gray-500">{a.doctor.name} • {a.patient.firstName} {a.patient.lastName}</div>
                    </div>
                    <div className="text-sm text-gray-700">{new Date(a.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Estado: <span className="font-medium text-gray-700">{a.status}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && <div className="mt-3 text-sm text-gray-500">Cargando citas...</div>}
    </div>
  );
};

export default PatientCalendar;
