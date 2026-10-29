import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Los textos legales con la app en inglés. El idioma se fija antes de cargar los módulos
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { LEGAL_PAGES, LEGAL_UPDATED, LEGAL_UPDATED_LABEL, OWNER, legalPageFor } =
  await import('../../src/services/legal.ts');
const { LegalNotice, PrivacyPolicy, TermsOfUse } = await import('../../src/components/LegalTexts.tsx');

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

test('the legal pages have English titles and keep their Spanish paths', () => {
  assert.deepEqual(
    LEGAL_PAGES.map(({ path, title }) => [path, title]),
    [
      ['/privacidad', 'Privacy policy'],
      ['/condiciones', 'Terms of use'],
      ['/aviso-legal', 'Legal notice']
    ]
  );
  assert.equal(legalPageFor('/condiciones/')?.id, 'terms');
});

test('the date shown is the same as the version accepted, which stays in Spanish', () => {
  const [, day, month, year] = /^(\d{1,2}) de (\p{L}+) de (\d{4})$/u.exec(LEGAL_UPDATED) ?? [];
  assert.ok(SPANISH_MONTHS.includes(month), `LEGAL_UPDATED sin el formato «29 de octubre de 2026»: ${LEGAL_UPDATED}`);
  const date = Date.UTC(Number(year), SPANISH_MONTHS.indexOf(month), Number(day));
  const english = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  assert.equal(LEGAL_UPDATED_LABEL, english.format(date), 'Cambia LEGAL_UPDATED_LABEL junto con LEGAL_UPDATED');
});

const render = (component: React.FC) => renderToStaticMarkup(createElement(component));
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');

test('each English legal text starts by saying the Spanish version prevails, and keeps the Spanish sections', () => {
  const sections: [React.FC, string[]][] = [
    [
      PrivacyPolicy,
      [
        'privacy-owner',
        'privacy-data',
        'privacy-basis',
        'privacy-recipients',
        'privacy-location',
        'privacy-retention',
        'privacy-rights',
        'privacy-minors',
        'privacy-automated',
        'privacy-security',
        'privacy-changes'
      ]
    ],
    [
      TermsOfUse,
      [
        'terms-service',
        'terms-age',
        'terms-account',
        'terms-use',
        'terms-content',
        'terms-availability',
        'terms-end',
        'terms-changes',
        'terms-contact',
        'terms-law'
      ]
    ],
    [LegalNotice, ['notice-owner', 'notice-ip', 'notice-links', 'notice-more', 'notice-affiliation']]
  ];
  for (const [component, ids] of sections) {
    const html = render(component);
    assert.match(html, /^<div role="note"[^>]*><p>This is a translation for your convenience\. The Spanish version/);
    assert.match(html, /<button type="button"[^>]*>Read the Spanish version<\/button>/);
    assert.deepEqual(
      [...html.matchAll(/<h2 id="([^"]+)"/g)].map(([, id]) => id),
      ids
    );
    // Nada a medio traducir: lo único en español son el domicilio y el título del libro
    const text = textOf(html).replace(OWNER.address, '').replace('Gestiona tu tiempo, disfruta de la vida', '');
    assert.doesNotMatch(text, /[«»¿¡ñáéíóú]/i);
  }
});

test('the English texts name the Spanish laws and authority by their English names and acronyms', () => {
  const privacy = textOf(render(PrivacyPolicy));
  for (const name of [
    'General Data Protection Regulation (GDPR',
    'LOPDGDD',
    'Art. 6(1)(b) GDPR',
    'LSSI',
    'Spanish Data Protection Agency (AEPD',
    'EU-U.S. Data Privacy Framework'
  ])
    assert.ok(privacy.includes(name), name);
  assert.ok(textOf(render(TermsOfUse)).includes('Digital Services Act (Regulation (EU) 2022/2065)'));
});
