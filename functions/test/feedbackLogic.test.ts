import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESCRIPTION_MAX_LENGTH,
  REPLY_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  buildFeedbackEmail,
  buildReplyEmail,
  parseContext,
  parseFeedback,
  parseReply,
  recentSends,
  type FeedbackTicket
} from '../src/feedbackLogic';

const context = {
  appVersion: '0.9.0',
  os: 'Android 15',
  browser: 'Chrome 141',
  deviceClass: 'móvil',
  language: 'es-ES',
  online: true
};

describe('mensajes de contacto', () => {
  it('acepta un mensaje con tipo, asunto y descripción, recortados', () => {
    assert.deepEqual(
      parseFeedback({ type: 'bug', subject: '  No carga la agenda ', description: ' Se queda en blanco. ' }),
      {
        type: 'bug',
        subject: 'No carga la agenda',
        description: 'Se queda en blanco.'
      }
    );
  });

  it('rechaza tipos desconocidos y asuntos o descripciones vacíos', () => {
    assert.equal(parseFeedback({ type: 'spam', subject: 'a', description: 'b' }), null);
    assert.equal(parseFeedback({ type: 'bug', subject: '   ', description: 'b' }), null);
    assert.equal(parseFeedback({ type: 'bug', subject: 'a', description: '' }), null);
    assert.equal(parseFeedback(null), null);
    assert.equal(parseFeedback('texto'), null);
  });

  it('limita las longitudes, deja el asunto en una línea y quita caracteres de control', () => {
    const parsed = parseFeedback({
      type: 'general',
      subject: `Hola\r\nBcc: alguien@example.com${'x'.repeat(200)}`,
      description: `Línea 1\nLínea 2\u0007${'y'.repeat(3000)}`
    })!;
    assert.equal(parsed.subject.length, SUBJECT_MAX_LENGTH);
    assert.ok(!/[\r\n]/.test(parsed.subject));
    assert.equal(parsed.description.length, DESCRIPTION_MAX_LENGTH);
    assert.ok(parsed.description.startsWith('Línea 1\nLínea 2y'));
  });

  it('guarda solo la información técnica conocida y válida', () => {
    assert.deepEqual(parseContext({ ...context, userAgent: 'Mozilla/5.0 …', ip: '1.2.3.4' }), context);
    assert.equal(parseContext({ ...context, deviceClass: 'nevera' }), undefined);
    assert.equal(parseContext({ ...context, online: 'sí' }), undefined);
    assert.equal(parseContext({ ...context, os: '' }), undefined);
    assert.deepEqual(parseFeedback({ type: 'bug', subject: 'a', description: 'b', context })?.context, context);
    assert.equal(parseFeedback({ type: 'bug', subject: 'a', description: 'b', context: 'x' })?.context, undefined);
  });

  it('cuenta para el límite solo los envíos de la última hora', () => {
    const now = new Date('2026-10-14T12:00:00.000Z');
    const sent = ['2026-10-14T10:59:59.000Z', '2026-10-14T11:00:01.000Z', '2026-10-14T11:59:00.000Z', 'no es fecha'];
    assert.deepEqual(recentSends(sent, now), ['2026-10-14T11:00:01.000Z', '2026-10-14T11:59:00.000Z']);
  });

  it('el correo a la administración va en texto plano y permite responder a quien escribe', () => {
    const ticket: FeedbackTicket = {
      uid: 'u1',
      email: 'ana@example.com',
      name: 'Ana',
      type: 'suggestion',
      subject: 'Modo oscuro',
      description: 'Estaría bien.',
      context: { ...context, deviceClass: 'móvil' },
      status: 'new',
      createdAt: '2026-10-14T12:00:00.000Z',
      updatedAt: '2026-10-14T12:00:00.000Z'
    };
    const email = buildFeedbackEmail(ticket, 'https://example.web.app');
    assert.equal(email.subject, '[CLAR] Sugerencia: Modo oscuro');
    assert.equal(email.replyTo, 'ana@example.com');
    assert.match(email.text, /Ana \(ana@example\.com\) ha escrito desde CLAR\./);
    assert.match(email.text, /- Navegador: Chrome 141/);
    assert.match(email.text, /«Mensajes»: https:\/\/example\.web\.app/);
  });
});

describe('respuestas de la administración', () => {
  const ticket: FeedbackTicket = {
    type: 'bug',
    subject: 'No carga la agenda',
    description: 'Se queda en blanco.\n\nPasa desde ayer.',
    uid: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    status: 'new',
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z'
  };

  it('acepta el id de un mensaje y un texto no vacío, sin caracteres de control', () => {
    assert.deepEqual(parseReply({ ticketId: 'AbC_12-x', message: '  Ya está arreglado.\u0007 ' }), {
      ticketId: 'AbC_12-x',
      message: 'Ya está arreglado.'
    });
    assert.equal(parseReply({ ticketId: 'AbC', message: '   ' }), null);
    assert.equal(parseReply({ ticketId: '../otro', message: 'Hola' }), null);
    assert.equal(parseReply({ message: 'Hola' }), null);
    assert.equal(parseReply(null), null);
    assert.equal(
      parseReply({ ticketId: 'a', message: 'x'.repeat(REPLY_MAX_LENGTH + 10) })?.message.length,
      REPLY_MAX_LENGTH
    );
  });

  it('responde por email a quien escribió, con su mensaje citado, y la respuesta vuelve a la administración', () => {
    const email = buildReplyEmail(ticket, 'Gracias, Ana. Ya está arreglado.', 'admin@example.com');
    assert.equal(email.subject, 'Re: [CLAR] No carga la agenda');
    assert.equal(email.replyTo, 'admin@example.com');
    assert.equal(
      email.text,
      [
        'Hola, Ana:',
        '',
        'Gracias, Ana. Ya está arreglado.',
        '',
        '—',
        'Equipo de CLAR',
        '',
        'Tu mensaje (Error o fallo):',
        '> No carga la agenda',
        '>',
        '> Se queda en blanco.',
        '>',
        '> Pasa desde ayer.'
      ].join('\n')
    );
    assert.match(buildReplyEmail({ ...ticket, name: '' }, 'Hola', 'admin@example.com').text, /^Hola:\n/);
  });
});
