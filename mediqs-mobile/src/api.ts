// ======================================================
// Cliente API de la app móvil (src/api.ts)
// Único punto de acceso al backend desde React Native:
//   - Sesión JWT persistida en el almacenamiento SEGURO del
//     dispositivo (expo-secure-store, cifrado por el SO).
//   - login / renovación de token / logout.
//   - Wrapper de fetch que adjunta el JWT y traduce errores.
// ======================================================
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * URL del backend. En desarrollo el celular habla con el MISMO servidor
 * de Expo (Metro) del que bajó la app, y Metro reenvía /api/* al backend
 * (ver metro.config.js). Así funciona en la misma red Wi-Fi y también con
 * `expo start --tunnel`. Se puede forzar con EXPO_PUBLIC_API_URL.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  // ej. "192.168.0.10:8081" (LAN, http) o "abc.on.expo.app" (túnel, https).
  // El túnel redirige http → https y en esa redirección los POST se
  // convierten en GET (login roto), por eso sin puerto se usa https.
  const hostUri = Constants.expoConfig?.hostUri;
  if (Platform.OS !== 'web' && hostUri) {
    const hasPort = /:\d+$/.test(hostUri);
    return `${hasPort ? 'http' : 'https'}://${hostUri}`;
  }
  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

const TOKEN_KEY = 'mediqs_token';

/** Token en memoria (espejo de lo guardado en SecureStore). */
let currentToken: string | null = null;

/**
 * Almacenamiento del token. expo-secure-store NO existe en web
 * (Expo web / navegador): ahí se usa localStorage. En iOS/Android
 * se mantiene el almacenamiento cifrado por el SO.
 */
const tokenStorage =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(TOKEN_KEY) ?? null,
        set: async (v: string) => globalThis.localStorage?.setItem(TOKEN_KEY, v),
        remove: async () => globalThis.localStorage?.removeItem(TOKEN_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (v: string) => SecureStore.setItemAsync(TOKEN_KEY, v),
        remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

/** Restaura el token guardado al abrir la app. */
export async function loadStoredToken(): Promise<string | null> {
  currentToken = await tokenStorage.get();
  return currentToken;
}

/** Persiste (o borra) el token de sesión en el almacenamiento del dispositivo. */
async function persistToken(token: string | null): Promise<void> {
  currentToken = token;
  if (token) await tokenStorage.set(token);
  else await tokenStorage.remove();
}

/** Error de API con código HTTP y mensaje del backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Convierte cualquier error en un mensaje mostrable. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

/** Petición JSON al backend con el JWT de la sesión. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new ApiError(res.status, (err as { error?: string }).error ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  delete: <T>(p: string, b?: unknown) => request<T>('DELETE', p, b),
};

// ------------------------------------------------------
// Sesión
// ------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  patientId?: string | null;
}

export const auth = {
  /**
   * Login del paciente: email cargado en su ficha + DNI.
   * Persiste el JWT en el dispositivo.
   */
  async login(email: string, documentId: string): Promise<SessionUser> {
    const data = await api.post<{ token: string; user: SessionUser }>('/api/auth/patient-login', {
      email,
      documentId,
    });
    await persistToken(data.token);
    return data.user;
  },

  /**
   * Restaura la sesión al abrir la app: si hay token guardado lo RENUEVA
   * contra el backend (extiende la expiración y refresca los roles).
   * Devuelve null si no hay sesión o el token ya no es válido.
   */
  async restore(): Promise<SessionUser | null> {
    const stored = await loadStoredToken();
    if (!stored) return null;
    try {
      const data = await api.post<{ token: string; user: SessionUser }>('/api/auth/refresh');
      await persistToken(data.token); // token renovado
      // /auth/me agrega patientId (necesario para el portal del paciente).
      return await api.get<SessionUser>('/api/auth/me');
    } catch {
      await persistToken(null);
      return null;
    }
  },

  /** Cierra la sesión localmente (borra el token del dispositivo). */
  async signOut(): Promise<void> {
    await persistToken(null);
  },
};
