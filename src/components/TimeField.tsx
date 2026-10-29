import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TIME_INPUT_PLACEHOLDER, parseTimeInput } from '../services/timeInput';
import { messages } from '../i18n/locale';

interface TimeFieldProps {
  // Nombre accesible del campo (salvo que haya un <label htmlFor={id}> visible)
  label: string;
  value: string; // HH:mm (24 h) o ''
  onChange: (value: string) => void;
  id?: string;
  hasVisibleLabel?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  // Avisa cuando lo escrito aún no es la hora guardada (a medias o imposible): para saber si hay cambios sin guardar
  onDraftChange?: (pending: boolean) => void;
}

const INVALID_MESSAGE = messages<string>(
  `Escribe la hora en 24 h, como ${TIME_INPUT_PLACEHOLDER} (de 00:00 a 23:59)`,
  `Write the time in 24-hour format, like ${TIME_INPUT_PLACEHOLDER} (00:00 to 23:59)`
);

// Hora en 24 h escrita a mano (9:30, 0930, 21:45…), en lugar del selector del navegador, que en sistemas en 12 h
// muestra a. m./p. m. Lo que no es aún una hora no se guarda y bloquea el envío del formulario con un mensaje.
export const TimeField: React.FC<TimeFieldProps> = ({
  label,
  value,
  onChange,
  id,
  hasVisibleLabel = false,
  disabled = false,
  className = '',
  'aria-describedby': describedBy,
  onDraftChange
}) => {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = disabled ? value : parseTimeInput(text);

  // Cambios desde fuera (otra tarea, se desactiva el campo…): se muestran sin pisar lo que se escribe
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setText((current) => (parseTimeInput(current) === value ? current : value));
  }

  useEffect(() => {
    inputRef.current?.setCustomValidity(parsed === null ? INVALID_MESSAGE : '');
  }, [parsed]);

  // Texto a medias o imposible: un cambio que aún no ha llegado al valor. Al desmontarse, deja de contar
  const pendingDraft = parsed !== value;
  const onDraftChangeRef = useRef(onDraftChange);
  useLayoutEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  });
  useEffect(() => {
    onDraftChangeRef.current?.(pendingDraft);
  }, [pendingDraft]);
  useEffect(() => () => onDraftChangeRef.current?.(false), []);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={TIME_INPUT_PLACEHOLDER}
      value={disabled ? value : text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        const next = parseTimeInput(e.target.value);
        if (next !== null) onChange(next);
      }}
      onBlur={() => parsed && setText(parsed)}
      aria-label={hasVisibleLabel ? undefined : label}
      aria-invalid={parsed === null || undefined}
      aria-describedby={describedBy}
      className={`${parsed === null ? 'border-red-400 bg-red-50/40' : ''} ${className}`}
    />
  );
};
