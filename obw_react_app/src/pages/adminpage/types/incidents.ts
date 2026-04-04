export type IncidentProgress = 'open' | 'in_progress' | 'closed';

export type Incident = {
  entityType: string;
  dateIncidentId: string;
  date: string;
  incidentId: string;
  roomId?: string;
  guestName?: string;
  issue?: string;
  currentLocation?: string;
  progress: IncidentProgress;
  staff?: string;
  timeSpent?: string;
  resolutionDate?: string;
  solution?: string;
  createdAt?: string;
  updatedAt?: string;
};
