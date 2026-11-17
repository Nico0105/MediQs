# MediQs Mobile — React Native + Expo

App móvil del Sistema de Seguimiento de Cirugías. Dos modos de uso:

- **Sin login (familiares)**: tablero público con el estado de las cirugías del
  día, identificadas sólo por su código anónimo. Filtro por código, refresco
  automático y pull-to-refresh.
- **Con login (rol paciente)**: portal de autogestión con
  - **Mis cirugías** — estado en vivo + checklist preoperatorio (sólo lectura)
  - **Mensajes** — consultas a recepción (urgente: respuesta en 24 h · normal: 48 h);
    al enviar se muestran las indicaciones pre/postoperatorias y los cuidados
  - **Síntomas** — registro diario (síntomas, dolor 0–10, observaciones) e historial
  - **Seguimiento** — controles e indicaciones cargados por el equipo médico
  - **Perfil** — datos personales y cierre de sesión

## Autenticación

- El paciente ingresa con el **email cargado en su ficha + su DNI**
  (`POST /api/auth/patient-login`, JWT). En el primer ingreso el backend le crea
  la cuenta de acceso y la vincula a su ficha.
- La sesión se **persiste cifrada** en el dispositivo (`expo-secure-store`;
  en Expo web se usa `localStorage`).
- Al abrir la app el token se **renueva** (`POST /api/auth/refresh`); si venció,
  se vuelve al login.
- Al cerrar sesión se borra el token local y se da de baja el token de push.

## Notificaciones push

La app registra su token de **Firebase Cloud Messaging** en `POST /api/fcm-tokens`
para recibir avisos (cambio de estado, seguimiento nuevo, recordatorios, alta).
En **Expo Go** el token nativo puede no estar disponible (el registro falla en
silencio); para producción hay que configurar el proyecto de Firebase
(`google-services.json`) con EAS Build o `expo prebuild`.
Detalle completo: [`../docs/NOTIFICACIONES.md`](../docs/NOTIFICACIONES.md).

## Ejecutar

Requiere **Expo SDK 58** → la app **Expo Go** de Play Store / App Store.

1. Levantá el backend (`cd backend && npm run dev`).
2. Conectá el celular a la **misma red Wi‑Fi** que la PC.
3. En `mediqs-mobile`:
   ```bash
   npm install
   npm start          # muestra un QR
   ```
4. Escaneá el QR: en Android desde Expo Go, en iPhone con la cámara.
   También podés escribir la URL `exp://<IP-de-la-PC>:8081` en Expo Go.

> **Backend**: la app le habla al mismo servidor de Expo (Metro) del que bajó el
> código, y Metro reenvía `/api/*` al backend local en el puerto 4000 (ver
> `metro.config.js` y `resolveApiUrl` en `src/api.ts`). Para apuntar a otro servidor:
> `EXPO_PUBLIC_API_URL=http://mi-servidor:4000 npm start`.

**Si no conecta:**
- Si la PC tiene varias placas de red (VMware, VirtualBox), forzá la IP correcta:
  `REACT_NATIVE_PACKAGER_HOSTNAME=<IP-de-la-PC> npm start`.
- Windows tiene que permitir conexiones entrantes a Node en el puerto 8081
  (aceptá el aviso del Firewall, o marcá la red como *Privada*).
- Si el celular y la PC están en redes distintas o aisladas (PC por cable y celular
  en el Wi‑Fi de la facultad), usá el túnel de Expo (requiere una cuenta gratuita
  de expo.dev): `npx expo login` y después `npx expo start --tunnel`.
  Publica la app en una URL `exp://….exp.direct` accesible desde cualquier red; el
  backend viaja por el mismo túnel, no hace falta exponerlo aparte.
  Ojo: mientras el túnel está abierto, cualquiera con esa URL llega a tu backend.

## Compilar y publicar (EAS Build)

Las apps compiladas llevan el código adentro y le hablan directo al **backend
desplegado**, así que primero tiene que estar publicado con **HTTPS** (Android e
iOS bloquean `http://` en apps instaladas). En `eas.json` (perfil `base`) reemplazá
`https://CAMBIAR-POR-LA-URL-DEL-BACKEND` por la URL real (sin `/api` al final).

Todo se compila en la nube de Expo con la cuenta de `npx expo login`. La primera
vez EAS pregunta si crea el proyecto y las claves de firma: aceptá (las guarda
EAS; **no las borres**, sin ellas no se pueden publicar actualizaciones).

| Objetivo | Comando | Costo |
|----------|---------|-------|
| **APK** para instalar a mano (tesis, demo) | `npx eas-cli build -p android --profile preview` | Gratis |
| **Google Play** (`.aab`) | `npx eas-cli build -p android --profile production` | Cuenta de desarrollador: USD 25 (única vez) |
| **App Store** (`.ipa`) | `npx eas-cli build -p ios --profile production` | Apple Developer Program: USD 99/año |

**APK:** al terminar (10–20 min) EAS muestra un link y un QR; abrilo desde el
celular, descargá la APK e instalala (Android pide permitir "instalar apps
desconocidas"). No necesita ninguna tienda ni cuenta paga.

**Subir a las tiendas** (cuando tengas las cuentas):
```bash
npx eas-cli submit -p android --profile production   # a la pista "internal" como borrador
npx eas-cli submit -p ios --profile production       # a App Store Connect / TestFlight
```
- La **primera** subida a Google Play hay que hacerla a mano desde Play Console
  (con el `.aab` que genera EAS); después `eas submit` funciona solo.
- Ambas tiendas piden **política de privacidad** (la app maneja datos de salud),
  capturas de pantalla, descripción y en Play el formulario de "Seguridad de datos".
- Los números de versión de las tiendas los incrementa EAS solo
  (`appVersionSource: remote` + `autoIncrement`). Para una versión visible nueva
  cambiá `version` en `app.json` (ej. `1.0.0` → `1.1.0`).
- Las notificaciones push en las apps compiladas necesitan Firebase
  (`google-services.json` en Android, credenciales APNs en iOS); ver
  [`../docs/NOTIFICACIONES.md`](../docs/NOTIFICACIONES.md). Sin eso la app
  funciona igual, sólo no llegan las push.

## Estructura

```
mediqs-mobile/
├── App.tsx                  # Sesión + navegación por pestañas
├── index.ts                 # Registro del componente raíz (Expo)
└── src/
    ├── api.ts               # Cliente HTTP + JWT + SecureStore
    ├── push.ts              # Registro/baja del token FCM
    ├── theme.ts             # Paleta y estilos base
    ├── types.ts             # Tipos de dominio + catálogos
    └── screens/
        ├── LoginScreen.tsx
        ├── BoardScreen.tsx      # Tablero público (familiares)
        ├── SurgeriesScreen.tsx  # Mis cirugías + checklist
        ├── SymptomsScreen.tsx   # Registro de síntomas
        ├── PostopScreen.tsx     # Seguimiento postoperatorio
        └── ProfileScreen.tsx
```
