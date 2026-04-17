const LOCAL_API_ORIGIN = "http://localhost:5000";
const PRODUCTION_API_ORIGIN = "https://byte2lifebackend-3.onrender.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const API_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? LOCAL_API_ORIGIN
      : PRODUCTION_API_ORIGIN),
);

export const API_BASE_URL = `${API_ORIGIN}/api`;

export function resolveApiUrl(url?: string) {
  if (!url) {
    return url;
  }

  if (url.startsWith(LOCAL_API_ORIGIN)) {
    return `${API_ORIGIN}${url.slice(LOCAL_API_ORIGIN.length)}`;
  }

  if (url.startsWith("/api/")) {
    return `${API_ORIGIN}${url}`;
  }

  return url;
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}${normalizedPath}`;
}
