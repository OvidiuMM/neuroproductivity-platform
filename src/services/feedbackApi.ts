import { httpsCallable, type Functions } from 'firebase/functions';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
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

const toTicket = (d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<FeedbackTicket, 'id'>), id: d.id });
const newestFirst = (a: FeedbackTicket, b: FeedbackTicket) => b.createdAt.localeCompare(a.createdAt);

// Solo la administración (las reglas no dejan leerlos a nadie más). En vivo solo los abiertos (nuevos y leídos), que
// son pocos; se ordenan aquí para no necesitar un índice compuesto
export const subscribeToOpenFeedback = (
  db: Firestore,
  onChange: (tickets: FeedbackTicket[]) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    query(collection(db, 'feedback_tickets'), where('status', 'in', ['new', 'read'])),
    (snapshot) => onChange(snapshot.docs.map(toTicket).sort(newestFirst)),
    onError
  );

// Los cerrados, por páginas y bajo demanda: se recorren los mensajes del más reciente al más antiguo (índice simple
// de createdAt) hasta reunir una página de cerrados o llegar al final
export interface ClosedFeedbackPage {
  tickets: FeedbackTicket[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}
const CLOSED_PAGE = 20;
const SCAN_PAGE = 50;
export const loadClosedFeedback = async (
  db: Firestore,
  cursor: QueryDocumentSnapshot | null = null
): Promise<ClosedFeedbackPage> => {
  const tickets: FeedbackTicket[] = [];
  let last = cursor;
  for (;;) {
    const page = await getDocs(
      query(
        collection(db, 'feedback_tickets'),
        orderBy('createdAt', 'desc'),
        ...(last ? [startAfter(last)] : []),
        limit(SCAN_PAGE)
      )
    );
    tickets.push(...page.docs.map(toTicket).filter((t) => t.status === 'closed'));
    last = page.docs.at(-1) ?? last;
    if (page.docs.length < SCAN_PAGE) return { tickets, cursor: last, hasMore: false };
    if (tickets.length >= CLOSED_PAGE) return { tickets, cursor: last, hasMore: true };
  }
};

export const setFeedbackStatus = (db: Firestore, id: string, status: FeedbackStatus) =>
  updateDoc(doc(db, 'feedback_tickets', id), { status, updatedAt: new Date().toISOString() });
