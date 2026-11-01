import type { DirectoryContact } from '../types/apartment';

export const DEFAULT_CONTACTS: DirectoryContact[] = [
  {
    id: 'c1',
    category: 'Plumber',
    name: 'Society Plumber',
    phone: '+91 90000 00001',
    alternate_phone: '+91 90000 00002',
    notes: 'Handles pipe leakages, PVC joints, water meter valve repairs and bathroom plumbing.',
    available_hours: '8:00 AM - 8:00 PM (Emergency 24x7)'
  },
  {
    id: 'c2',
    category: 'Electrician',
    name: 'Society Electrician',
    phone: '+91 90000 00003',
    notes: 'Handles phase changes, transformer fuses, meter board wiring, capacitor replacements.',
    available_hours: '9:00 AM - 7:00 PM'
  },
  {
    id: 'c3',
    category: 'Security & Watchman',
    name: 'Building Watchman',
    phone: '+91 90000 00004',
    notes: 'On-site watchman. Coordinates water motor on/off, daily garbage collection, gate entry.',
    available_hours: 'Resides at Gate Security Cabin (24x7)'
  },
  {
    id: 'c4',
    category: 'Security & Watchman',
    name: 'Security Agency Supervisor',
    phone: '+91 90000 00005',
    notes: 'Society security contract agency supervisor for guard shifts and night patrols.',
    available_hours: '24x7 Control Room'
  },
  {
    id: 'c5',
    category: 'Water Tanker',
    name: 'Water Tanker Supplier',
    phone: '+91 90000 00006',
    alternate_phone: '+91 90000 00007',
    notes: 'Primary tanker supplier. Call by 7:00 AM for same-day sump replenishment.',
    available_hours: '6:00 AM - 10:00 PM'
  },
  {
    id: 'c6',
    category: 'Elevator / Lift',
    name: 'Elevator AMC Helpline',
    phone: '1800 200 0000',
    alternate_phone: '+91 90000 00008',
    notes: 'Use helpline for immediate breakdown emergency rescue.',
    available_hours: '24x7 Emergency Helpline'
  },
  {
    id: 'c7',
    category: 'Borewell & Motors',
    name: 'Motor & Pump Technician',
    phone: '+91 90000 00009',
    notes: 'Motor winding, starter coil repairs, automatic water level controller technician.',
    available_hours: '8:00 AM - 6:00 PM'
  },
  {
    id: 'c8',
    category: 'Sanitation',
    name: 'Garbage Collection Team',
    phone: '+91 90000 00010',
    notes: 'Daily door-to-door dry and wet waste pickup at 8:30 AM.',
    available_hours: '7:30 AM - 11:00 AM'
  },
  {
    id: 'c9',
    category: 'Water Tanker',
    name: 'Water Supply Lineworker',
    phone: '+91 90000 00011',
    notes: 'Municipal piped supply valve operator and water bill queries.',
    available_hours: '10:00 AM - 5:00 PM'
  },
  {
    id: 'c10',
    category: 'Committee',
    name: 'Society President (Demo)',
    phone: '+91 90000 00012',
    notes: 'Residents Association President. For general policy and grievance escalation.',
    available_hours: '6:00 PM - 9:00 PM'
  },
  {
    id: 'c11',
    category: 'Committee',
    name: 'Society Treasurer (Demo)',
    phone: '+91 90000 00013',
    notes: 'Handles maintenance payment receipts, online bank transfers, and society accounts.',
    available_hours: '7:00 PM - 9:30 PM'
  }
];
