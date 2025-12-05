import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import { Spinner } from '../components/common/Spinner';
import { getAppointmentTypes } from '../api/appointmentTypes';
import { getDoctors } from '../api/users';
import { getAvailabilityForDate, requestAppointment } from '../api/scheduling';
import { getPatientPortalOverview } from '../api/patientPortal';
import { type AppointmentType, type DoctorAvailability, type AppointmentRequestInput } from '../types';
import { useNavigate } from 'react-router-dom';

const DEFAULT_MODALITY: AppointmentRequestInput['modality'] = 'presencial';

const todayIso = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tzOffset * 60000);
  return local.toISOString().split('T')[0];
};

const RequestAppointmentPage: React.FC = () => {
  const navigate = useNavigate();

  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('any');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());

  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<{ doctorId: string; startTime: string; endTime: string } | null>(null);

  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [modality, setModality] = useState<AppointmentRequestInput['modality']>(DEFAULT_MODALITY);
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [types, doctorsList, overview] = await Promise.all([
          getAppointmentTypes(),
          getDoctors(),
          getPatientPortalOverview().catch(() => null),
        ]);
        setAppointmentTypes(types);
        if (types.length > 0) {
          setSelectedTypeId(types[0].id);
        }
        setDoctors(doctorsList.map(doc => ({ id: doc.id, name: doc.name || 'Doctor sin nombre' })));
        if (overview && overview.patient?.contactInfo) {
          setContactPhone(overview.patient.contactInfo.phone || '');
          setContactEmail(overview.patient.contactInfo.email || '');
        }
      } catch (err) {
        console.error('[RequestAppointment] bootstrap failure', err);
      }
    };
    bootstrap();
  }, []);

  const availabilityDoctorIds = useMemo(() => {
    if (selectedDoctorId && selectedDoctorId !== 'any') {
      return [selectedDoctorId];
    }
    return availability.map(entry => entry.doctorId);
  }, [availability, selectedDoctorId]);

  useEffect(() => {
    if (!selectedTypeId || !selectedDate) {
      return;
    }

    const loadAvailability = async () => {
      setIsLoadingAvailability(true);
      setAvailabilityError(null);
      setSelectedSlot(null);
      try {
        const dateIso = new Date(`${selectedDate}T00:00:00`).toISOString();
        const availabilityResponse = await getAvailabilityForDate({
          date: dateIso,
          appointmentTypeId: selectedTypeId,
          doctorId: selectedDoctorId,
        });
        setAvailability(availabilityResponse);
        if (selectedDoctorId === 'any' && availabilityResponse.length > 0) {
          setSelectedSlot(null);
        }
        if (selectedDoctorId !== 'any' && availabilityResponse.length > 0) {
          const firstDoctor = availabilityResponse[0];
          if (firstDoctor.slots.length === 0) {
            setSelectedSlot(null);
          }
        }
      } catch (err) {
        console.error('[RequestAppointment] availability error', err);
        setAvailabilityError('No pudimos obtener la disponibilidad. Intente con otra fecha o doctor.');
        setAvailability([]);
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    loadAvailability();
  }, [selectedTypeId, selectedDate, selectedDoctorId]);

  const handleDoctorChange = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setSelectedSlot(null);
  };

  const handleSlotSelection = (doctorId: string, startTime: string, endTime: string) => {
    setSelectedSlot({ doctorId, startTime, endTime });
  };

  const canSubmit = useMemo(() => {
    return !!(selectedSlot && selectedTypeId && !isSubmitting);
  }, [selectedSlot, selectedTypeId, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !selectedTypeId) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await requestAppointment({
        appointmentTypeId: selectedTypeId,
        doctorId: selectedSlot.doctorId,
        startTime: selectedSlot.startTime,
        reason,
        notes,
        modality,
        contactPhone,
        contactEmail,
      });
      setSubmissionSuccess(true);
      setTimeout(() => {
        navigate('/mis-citas');
      }, 1800);
    } catch (err) {
      console.error('[RequestAppointment] submission error', err);
      setSubmissionError('No se pudo completar la solicitud. Verifique los datos e intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAppointmentTypeSelector = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800">1. Seleccione la especialidad</h3>
      <p className="text-sm text-slate-500 mb-4">Elija el tipo de consulta que requiere. Esto determina la duración y el especialista adecuado.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {appointmentTypes.map(type => {
          const isSelected = type.id === selectedTypeId;
          return (
            <button
              key={type.id}
              className={`text-left p-4 rounded-lg border transition ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'}`}
              onClick={() => setSelectedTypeId(type.id)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-slate-800">{type.name}</h4>
                <span className="text-sm text-teal-600 font-semibold">{type.durationMinutes} min</span>
              </div>
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{type.description || 'Consulta médica'}</p>
            </button>
          );
        })}
        {appointmentTypes.length === 0 && (
          <div className="text-sm text-slate-500">No hay tipos de citas configurados.</div>
        )}
      </div>
    </div>
  );

  const renderDoctorSelector = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800">2. Seleccione el profesional</h3>
      <p className="text-sm text-slate-500 mb-4">Puede elegir un doctor específico o permitir que asignemos automáticamente al más adecuado según disponibilidad.</p>
      <div className="space-y-2">
        <button
          type="button"
          className={`w-full text-left p-3 rounded-md border transition ${selectedDoctorId === 'any' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'}`}
          onClick={() => handleDoctorChange('any')}
        >
          <h4 className="text-sm font-semibold text-slate-800">Cualquier doctor disponible</h4>
          <p className="text-xs text-slate-500">Encontraremos un profesional con disponibilidad en la fecha seleccionada.</p>
        </button>
        {doctors.map(doc => {
          const isSelected = selectedDoctorId === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              className={`w-full text-left p-3 rounded-md border transition ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'}`}
              onClick={() => handleDoctorChange(doc.id)}
            >
              <h4 className="text-sm font-semibold text-slate-800">{doc.name}</h4>
              <p className="text-xs text-slate-500">Consulta presencial</p>
            </button>
          );
        })}
        {doctors.length === 0 && <p className="text-sm text-slate-500">No hay doctores disponibles en este momento.</p>}
      </div>
    </div>
  );

  const renderDateSelector = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800">3. Seleccione la fecha de la cita</h3>
      <p className="text-sm text-slate-500 mb-4">Puede agendar citas a partir de hoy. La disponibilidad se mostrará por día.</p>
      <input
        type="date"
        className="w-full md:w-64 border border-slate-300 rounded-md px-3 py-2 text-sm"
        value={selectedDate}
        min={todayIso()}
        onChange={e => setSelectedDate(e.target.value)}
      />
    </div>
  );

  const renderAvailability = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">4. Seleccione un horario disponible</h3>
        <p className="text-sm text-slate-500 mb-4">Los horarios se generan en base a la duración del servicio y evitan conflictos con otras citas.</p>
        {isLoadingAvailability ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : availabilityError ? (
          <p className="text-sm text-red-500">{availabilityError}</p>
        ) : availability.length === 0 ? (
          <p className="text-sm text-slate-500">No encontramos disponibilidad para el día seleccionado. Intente cambiar de fecha o profesional.</p>
        ) : (
          <div className="space-y-4">
            {availability.map(entry => {
              const showDoctorHeader = selectedDoctorId === 'any' || availabilityDoctorIds.length > 1;
              return (
                <div key={entry.doctorId}>
                  {showDoctorHeader && (
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-700">{entry.doctorName}</h4>
                      <span className="text-xs text-slate-500">{entry.slots.length} horarios disponibles</span>
                    </div>
                  )}
                  {entry.slots.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin espacios libres para este día.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {entry.slots.map(slot => {
                        const isSelected = selectedSlot?.doctorId === entry.doctorId && selectedSlot?.startTime === slot.startTime;
                        const startLabel = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const endLabel = new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <button
                            key={`${entry.doctorId}-${slot.startTime}`}
                            type="button"
                            onClick={() => handleSlotSelection(entry.doctorId, slot.startTime, slot.endTime)}
                            className={`p-3 rounded-md border text-sm font-semibold transition ${isSelected ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white hover:border-teal-300 text-slate-700'}`}
                          >
                            {startLabel} - {endLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAdditionalInformation = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800">5. Información adicional</h3>
      <p className="text-sm text-slate-500 mb-4">Comparta detalles relevantes para el equipo médico. Esta información será enviada junto con su solicitud.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo de la consulta</label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Ej. Dolor de cabeza recurrente"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={modality}
            onChange={e => setModality(e.target.value as AppointmentRequestInput['modality'])}
          >
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono de contacto</label>
          <input
            type="tel"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notas para el médico</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            placeholder="Información adicional que desee compartir..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitar nueva cita">
        <button
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-md"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </PageHeader>

      {submissionSuccess ? (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md">
          <h3 className="text-lg font-semibold">¡Solicitud enviada!</h3>
          <p className="text-sm">Su solicitud fue registrada. Nuestro equipo la revisará y recibirá una confirmación por correo o teléfono.</p>
        </div>
      ) : null}

      {submissionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <p className="text-sm">{submissionError}</p>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {renderAppointmentTypeSelector()}
        {renderDoctorSelector()}
        {renderDateSelector()}
        {renderAvailability()}
        {renderAdditionalInformation()}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`px-6 py-2 rounded-md text-white font-semibold transition ${canSubmit ? 'bg-teal-500 hover:bg-teal-600' : 'bg-slate-300 cursor-not-allowed'}`}
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar cita'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestAppointmentPage;
