import React from 'react';
import { EMAIL_PROVIDER, MIN_AGE, OWNER, legalPath } from '../services/legal';

// Contenido de los textos legales. Si cambia, cambia también LEGAL_UPDATED (src/services/legal.ts).

const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section aria-labelledby={id} className="space-y-2">
    <h2 id={id} className="pt-4 text-base font-bold text-slate-900">
      {title}
    </h2>
    {children}
  </section>
);

const List: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
);

const ownerName = () => OWNER.name || '[nombre del titular]';

const Contact: React.FC = () =>
  OWNER.email ? (
    <a href={`mailto:${OWNER.email}`} className="font-semibold text-indigo-700 underline hover:text-indigo-900">
      {OWNER.email}
    </a>
  ) : (
    <span>[email de contacto]</span>
  );

const PageLink: React.FC<{ to: Parameters<typeof legalPath>[0]; children: React.ReactNode }> = ({ to, children }) => (
  <a href={legalPath(to)} className="font-semibold text-indigo-700 underline hover:text-indigo-900">
    {children}
  </a>
);

export const PrivacyPolicy: React.FC = () => (
  <>
    <p>
      CLAR es una app gratuita, sin publicidad, para organizar tu tiempo. Aquí se explica qué datos tuyos trata, para
      qué, quién los ve, cuánto tiempo se guardan y cómo ejercer tus derechos, según el Reglamento General de Protección
      de Datos (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
    </p>

    <Section id="privacy-owner" title="Quién es el responsable">
      <p>
        {ownerName()}, persona física y titular de CLAR, sin actividad económica. Para cualquier cuestión sobre tus
        datos: <Contact />.
      </p>
    </Section>

    <Section id="privacy-data" title="Qué datos tratamos y para qué">
      <List>
        <li>
          <strong>Tu cuenta:</strong> nombre, email, foto de perfil (si entras con Google), fecha de alta y del último
          acceso. Si entras con email, la contraseña la guarda Firebase Authentication de forma que nadie, tampoco CLAR,
          puede leerla. Sirven para crear tu cuenta y dejarte entrar.
        </li>
        <li>
          <strong>Lo que escribes en CLAR:</strong> tareas (títulos, descripciones, notas, enlaces, fechas y alarmas),
          metas, evaluaciones de la Rueda de la Vida (tu puntuación de 0 a 10 en cada área), reuniones y correos de
          «Tiempo protegido» (asunto, texto, destinatarios y el nombre y el tamaño de los adjuntos: los archivos no
          salen de tu dispositivo). Sirven para que la app funcione. Las reuniones y los correos pueden incluir el
          nombre y el email de otras personas: añádelos solo si tienes motivo para ello.
        </li>
        <li>
          <strong>Solicitud de acceso:</strong> si la administración aprueba las cuentas una a una, tu nombre, email,
          foto y el mensaje que escribas, con el estado y la fecha de la decisión. Sirven para decidir el acceso y
          evitar abusos.
        </li>
        <li>
          <strong>Mensajes de «Escríbenos»:</strong> el tipo, el asunto y el texto, con tu nombre y tu email, y las
          respuestas de la administración. Si lo marcas, también la información técnica que ves antes de enviarlo
          (versión de CLAR, sistema, navegador, tipo de dispositivo, idioma y conexión). Para limitar los envíos a cinco
          por hora se guardan las horas de los de la última hora. Sirven para atenderte y responderte por email.
        </li>
        <li>
          <strong>Cuentas bloqueadas:</strong> el email de una cuenta bloqueada por abuso, para que no pueda volver a
          registrarse.
        </li>
        <li>
          <strong>En tu dispositivo:</strong> la sesión de Firebase, una copia de tus datos para usar la app sin
          conexión (se borra al cerrar sesión; ver «Cuánto tiempo se guardan») y algunas preferencias: accesibilidad,
          orden y filtros de las listas, alarmas ya avisadas y si viste la bienvenida. Todo es necesario para que la app
          funcione: CLAR no usa cookies de seguimiento, analítica ni publicidad.
        </li>
      </List>
      <p>
        CLAR no te pide datos de salud, creencias ni otros especialmente protegidos. Las áreas de la Rueda (por ejemplo,
        «Salud» o «Espiritualidad») recogen tu valoración personal de cada área. Si escribes datos de ese tipo en tus
        textos, solo se usan para mostrártelos a ti.
      </p>
    </Section>

    <Section id="privacy-basis" title="Base jurídica">
      <List>
        <li>
          <strong>Ejecución del contrato</strong> (art. 6.1.b RGPD), al aceptar las{' '}
          <PageLink to="terms">condiciones de uso</PageLink>: tu cuenta, lo que escribes en CLAR, los emails sobre tu
          acceso y las respuestas a tus mensajes.
        </li>
        <li>
          <strong>Interés legítimo</strong> (art. 6.1.f RGPD) en mantener CLAR segura y sin abusos: la aprobación y el
          bloqueo de cuentas, el límite de mensajes y los registros técnicos.
        </li>
        <li>
          <strong>Consentimiento</strong> (art. 6.1.a RGPD): la información técnica opcional de tus mensajes. Puedes
          retirarlo escribiendo a <Contact />.
        </li>
      </List>
    </Section>

    <Section id="privacy-recipients" title="Quién ve tus datos">
      <List>
        <li>Tú, desde cualquier dispositivo con tu cuenta.</li>
        <li>
          Desde la app, la administración de CLAR (su titular) ve solo las solicitudes de acceso y los mensajes de
          «Escríbenos»: las reglas de la base de datos no le dejan leer tus tareas, metas, evaluaciones, reuniones ni
          correos. Como responsable del proyecto en Google Cloud, el titular podría acceder técnicamente a todos los
          datos desde la consola; solo lo hará cuando sea imprescindible para mantener el servicio, resolver una
          incidencia o atender una petición tuya.
        </li>
        <li>
          Encargados del tratamiento, que tratan los datos solo para prestar su servicio: Google, con Firebase
          (Authentication, Firestore, Cloud Functions y Hosting), y {EMAIL_PROVIDER}, en la UE, para los emails de CLAR.
        </li>
        <li>
          Otros servicios, solo cuando tú lo decides: al usar «Añadir al calendario» con Google Calendar u Outlook, el
          título y la descripción de la tarea van en el enlace; «Abrir en mi correo» pasa el correo a tu programa de
          correo.
        </li>
      </List>
      <p>CLAR no vende ni cede tus datos a nadie.</p>
    </Section>

    <Section id="privacy-location" title="Dónde se guardan y transferencias internacionales">
      <p>
        Lo que escribes en CLAR se guarda en servidores de Google Cloud en la Unión Europea (Bélgica), y los emails
        salen de {EMAIL_PROVIDER}, también en la UE. Firebase Authentication (tu cuenta: nombre, email y foto) puede
        tratar datos fuera de la UE, en Estados Unidos, con las garantías del Marco de Privacidad de Datos UE-EE. UU.
        (decisión de adecuación de la Comisión Europea de 10 de julio de 2023) y de las cláusulas contractuales tipo de
        la Comisión.
      </p>
    </Section>

    <Section id="privacy-retention" title="Cuánto tiempo se guardan">
      <List>
        <li>Tu cuenta y lo que escribes: hasta que lo borres o elimines la cuenta.</li>
        <li>Solicitud de acceso y mensajes de «Escríbenos»: hasta que elimines la cuenta.</li>
        <li>
          Horas de envío de los mensajes: cuentan una hora para el límite de cinco, pero no se borran solas. Se
          descartan cuando envías otro mensaje pasada esa hora; si no envías ninguno más, o eliminas la cuenta justo
          después de escribir, se conservan, ligadas solo al identificador interno de tu cuenta y sin ningún otro dato
          tuyo, para que el límite se siga aplicando.
        </li>
        <li>Email de una cuenta bloqueada: mientras dure el bloqueo, también si la cuenta se elimina.</li>
        <li>
          Lo que contestes por email a nuestras respuestas: llega al buzón de <Contact /> y se guarda el tiempo
          necesario para atenderte.
        </li>
        <li>
          Copia en tu dispositivo: hasta que cierres sesión. Si en ese momento CLAR está abierta en otras pestañas, el
          navegador no deja borrarla y se queda hasta que vuelvas a cerrar sesión con una sola pestaña abierta.
        </li>
      </List>
    </Section>

    <Section id="privacy-rights" title="Tus derechos">
      <p>
        Tienes derecho a acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento, limitarlo y
        llevártelos (portabilidad). Casi todo lo puedes hacer tú desde la app:
      </p>
      <List>
        <li>Cambiar o borrar cualquier tarea, meta o correo.</li>
        <li>«Descargar mis datos», en el menú de tu cuenta: un archivo JSON con lo que has escrito.</li>
        <li>«Eliminar la cuenta», en el mismo menú: borra tu cuenta y todo su contenido.</li>
      </List>
      <p>
        Para lo demás, escribe a <Contact />. Te responderemos en un mes como máximo. Si no estás de acuerdo con la
        respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (
        <a
          href="https://www.aepd.es"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-indigo-700 underline hover:text-indigo-900"
        >
          aepd.es
        </a>
        ).
      </p>
    </Section>

    <Section id="privacy-minors" title="Menores">
      <p>
        CLAR es para personas de {MIN_AGE} años o más. Si tienes menos, no la uses. Si sabemos que una cuenta es de
        alguien menor de {MIN_AGE} años, la eliminaremos.
      </p>
    </Section>

    <Section id="privacy-automated" title="Decisiones automatizadas">
      <p>
        Las sugerencias de CLAR (el Top 10, las recomendaciones de Inicio o el área que propone para una tarea) se
        calculan en tu navegador y solo te orientan: no hay decisiones automatizadas con efectos jurídicos ni que te
        afecten de forma significativa.
      </p>
    </Section>

    <Section id="privacy-security" title="Seguridad">
      <p>
        Las conexiones van cifradas (HTTPS) y Google cifra los datos guardados. Las reglas de la base de datos solo
        dejan a cada cuenta acceder a lo suyo, y la app limita lo que el navegador puede cargar. Si hubiera una brecha
        de seguridad que afecte a tus datos, se notificará a la AEPD y, si supone un riesgo alto para ti, también a ti.
      </p>
    </Section>

    <Section id="privacy-changes" title="Cambios">
      <p>
        Si esta política cambia, la nueva versión se publicará aquí con su fecha. Si el cambio es importante, te
        avisaremos en la app o por email.
      </p>
    </Section>
  </>
);

export const TermsOfUse: React.FC = () => (
  <>
    <p>
      Estas condiciones regulan el uso de CLAR. Al crear tu cuenta o seguir usándola, las aceptas. Cómo se tratan tus
      datos se explica en la <PageLink to="privacy">política de privacidad</PageLink>.
    </p>

    <Section id="terms-service" title="El servicio">
      <p>
        CLAR es una app gratuita para organizar el tiempo: Rueda de la Vida, metas, tareas, agenda, alarmas y
        herramientas para proteger tu tiempo. La ofrece {ownerName()}, como proyecto personal. CLAR no envía correos en
        tu nombre: los prepara para que los envíes tú.
      </p>
    </Section>

    <Section id="terms-age" title="Quién puede usarla">
      <p>
        Personas de {MIN_AGE} años o más. Si la administración aprueba las cuentas una a una, necesitas su aprobación
        para empezar a usarla.
      </p>
    </Section>

    <Section id="terms-account" title="Tu cuenta">
      <List>
        <li>Usa datos verdaderos y guarda tu contraseña: lo que se haga con tu cuenta es responsabilidad tuya.</li>
        <li>
          Si crees que alguien ha entrado en tu cuenta, cambia la contraseña y cierra la sesión en todos los
          dispositivos.
        </li>
      </List>
    </Section>

    <Section id="terms-use" title="Uso aceptable">
      <p>No está permitido:</p>
      <List>
        <li>usar CLAR para actividades ilegales o para guardar contenido ilícito;</li>
        <li>añadir datos de otras personas sin motivo legítimo;</li>
        <li>intentar acceder a datos de otras cuentas, saltarse los límites o atacar el servicio;</li>
        <li>enviar mensajes abusivos o publicidad por «Escríbenos».</li>
      </List>
      <p>
        Si se incumplen estas condiciones, la administración puede retirar o bloquear el acceso. Aun así, podrás
        descargar o eliminar tus datos.
      </p>
    </Section>

    <Section id="terms-content" title="Tu contenido">
      <p>Lo que escribes en CLAR es tuyo. Solo se guarda y se procesa para mostrártelo y hacer funcionar la app.</p>
    </Section>

    <Section id="terms-availability" title="Disponibilidad y responsabilidad">
      <p>
        CLAR se ofrece gratis y tal como está. Se intenta que funcione siempre y sin errores, pero no se puede
        garantizar. Descarga tus datos de vez en cuando desde el menú de tu cuenta. Si CLAR deja de ofrecerse, se
        avisará con tiempo suficiente para que puedas descargarlos. Nada de esto limita los derechos que te reconoce la
        ley como consumidor.
      </p>
    </Section>

    <Section id="terms-end" title="Darte de baja">
      <p>Puedes eliminar tu cuenta cuando quieras, desde el menú de tu cuenta.</p>
    </Section>

    <Section id="terms-changes" title="Cambios en las condiciones">
      <p>
        Si cambian, la nueva versión se publicará aquí con su fecha. Si el cambio es importante, te avisaremos en la app
        o por email antes de que se aplique.
      </p>
    </Section>

    <Section id="terms-contact" title="Contacto y avisos de contenido ilícito">
      <p>
        Para cualquier duda, o para avisar de contenido ilícito, escribe a <Contact />, en español. Es también el punto
        de contacto del Reglamento de Servicios Digitales (Reglamento (UE) 2022/2065).
      </p>
    </Section>

    <Section id="terms-law" title="Ley aplicable">
      <p>
        Estas condiciones se rigen por la ley española. Si eres consumidor, puedes acudir a los tribunales de tu
        domicilio.
      </p>
    </Section>
  </>
);

export const LegalNotice: React.FC = () => (
  <>
    <Section id="notice-owner" title="Titular">
      <p>
        CLAR (clar.life) es un proyecto personal de {ownerName()}, persona física, gratuito, sin publicidad y sin
        actividad económica. Contacto: <Contact />.
      </p>
    </Section>

    <Section id="notice-ip" title="Propiedad intelectual">
      <p>
        El código de CLAR es software libre con licencia MIT. El nombre y el logotipo de CLAR pertenecen a su titular.
        Lo que escribes en la app es tuyo.
      </p>
    </Section>

    <Section id="notice-links" title="Enlaces">
      <p>
        CLAR enlaza con servicios de otros, como Google Calendar u Outlook. No es responsable de su contenido ni de sus
        condiciones.
      </p>
    </Section>

    <Section id="notice-more" title="Más información">
      <p>
        Cómo se tratan tus datos: <PageLink to="privacy">política de privacidad</PageLink>. Normas de uso:{' '}
        <PageLink to="terms">condiciones de uso</PageLink>.
      </p>
    </Section>
  </>
);
