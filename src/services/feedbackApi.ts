import { httpsCallable, type Functions } from 'firebase/functions';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, type Firestore } from 'firebase/firestore';
import type { FeedbackContext, FeedbackType } from './feedback';

export type FeedbackStatus = 'new' | 'read' | 'closed';

// Mensaje de contacto tal como lo guarda la Cloud Function submitFeedback (feedback_tickets)
export interface FeedbackTicket {
  id: string;
  uid: string;
  email: string;
  name: string;
  type: FeedbackType;
  subject: string;
  description: string;
  context?: FeedbackContext;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackInput {
  type: FeedbackType;
  subject: string;
  description: string;
  context?: FeedbackContext;
}

export const submitFeedback = async (functions: Functions, input: FeedbackInput) =>
  (await httpsCallable<FeedbackInput, { id: string }>(functions, 'submitFeedback')(input)).data;

// Solo la administración (las reglas no dejan leerlos a nadie más): los más recientes primero
export const subscribeToFeedback = (
  db: Firestore,
  onChange: (tickets: FeedbackTicket[]) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    query(collection(db, 'feedback_tickets'), orderBy('createdAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ ...(d.data() as Omit<FeedbackTicket, 'id'>), id: d.id }))),
    onError
  );

export const setFeedbackStatus = (db: Firestore, id: string, status: FeedbackStatus) =>
  updateDoc(doc(db, 'feedback_tickets', id), { status, updatedAt: new Date().toISOString() });
