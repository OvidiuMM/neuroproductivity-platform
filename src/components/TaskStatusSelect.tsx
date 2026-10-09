import React from 'react';
import { TaskStatus } from '../types';
import { TASK_STATUSES } from '../services/tasks';

interface TaskStatusSelectProps {
  status: TaskStatus;
  taskTitle: string;
  onChange: (status: TaskStatus) => void;
  size?: 'sm' | 'xs';
}

// Estado manual; elegir "Hecha" archiva la tarea y cualquier otro estado la reactiva
export const TaskStatusSelect: React.FC<TaskStatusSelectProps> = ({ status, taskTitle, onChange, size = 'sm' }) => {
  const current = TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      aria-label={`Estado de «${taskTitle}»`}
      className={`rounded-lg border font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${current.className} ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      }`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
};
