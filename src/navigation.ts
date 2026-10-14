import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  LayoutDashboard,
  ShieldCheck,
  Target,
  UserCheck,
  type LucideIcon
} from 'lucide-react';
import type { AppTab } from './types';

export interface Section {
  tab: AppTab;
  // Nombre completo (pestañas de escritorio y nombre accesible en todos los tamaños)
  label: string;
  // Nombre corto de la barra inferior del móvil; está contenido en `label`, así se oye lo que se ve
  short: string;
  icon: LucideIcon;
  // Solo icono en escritorio: con su nombre la cabecera no cabe en una línea a 1280 px
  iconOnly?: boolean;
}

export const SECTIONS: Section[] = [
  { tab: 'home', label: 'Inicio', short: 'Inicio', icon: LayoutDashboard },
  { tab: 'tasks', label: 'Listas', short: 'Listas', icon: Briefcase },
  { tab: 'agenda', label: 'Agenda', short: 'Agenda', icon: CalendarDays },
  { tab: 'wheel', label: 'Rueda de la Vida', short: 'Rueda', icon: Compass },
  { tab: 'goals', label: 'Metas', short: 'Metas', icon: Target },
  { tab: 'bermudas', label: 'Tiempo protegido', short: 'Bermudas', icon: ShieldCheck },
  { tab: 'help', label: 'Ayuda', short: 'Ayuda', icon: BookOpen, iconOnly: true }
];

// Solo para la administración (solicitudes de acceso y mensajes de contacto), delante de «Ayuda»
const ACCESS_SECTION: Section = {
  tab: 'access',
  label: 'Administración',
  short: 'Administración',
  icon: UserCheck,
  iconOnly: true
};

export const sectionsFor = (isAdmin: boolean) =>
  isAdmin ? [...SECTIONS.slice(0, -1), ACCESS_SECTION, ...SECTIONS.slice(-1)] : SECTIONS;

// En el móvil estas van en la barra inferior; las demás (la Rueda incluida), en «Más»
export const PRIMARY_TABS: readonly AppTab[] = ['home', 'tasks', 'agenda', 'goals'];

// Nombre accesible con lo pendiente en administración: solicitudes y mensajes nuevos (el globo es solo visual)
export const sectionLabel = ({ tab, label }: Section, pendingAccessCount: number) =>
  tab === 'access' && pendingAccessCount > 0
    ? `${label}, ${pendingAccessCount} ${pendingAccessCount === 1 ? 'pendiente' : 'pendientes'}`
    : label;
