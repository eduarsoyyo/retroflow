export const ABSENCE_TYPES = [
  { id: 'vacation', label: 'Vacaciones', color: '#007AFF', icon: 'Palmtree' },
  { id: 'personal', label: 'Asuntos propios', color: '#FF9500', icon: 'User' },
  { id: 'sick', label: 'Baja médica', color: '#FF3B30', icon: 'Heart' },
  { id: 'maternity', label: 'Maternidad/Paternidad', color: '#AF52DE', icon: 'Baby' },
  { id: 'training', label: 'Formación', color: '#34C759', icon: 'GraduationCap' },
  { id: 'remote', label: 'Teletrabajo', color: '#5AC8FA', icon: 'Wifi' },
  { id: 'holiday', label: 'Festivo', color: '#86868B', icon: 'Calendar' },
] as const

export type AbsenceTypeId = typeof ABSENCE_TYPES[number]['id']
