"use client";

import { resolveApiUrl } from "@/utils/api";
import axios from "axios";
import { useEffect, useRef } from "react";
import { getIdToken } from "../services/auth.service";

export default function AxiosLogger() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const requestInterceptorId = axios.interceptors.request.use(async (config) => {
      config.url = resolveApiUrl(config.url);

      const token = await getIdToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url;
        const method = error?.config?.method?.toUpperCase();
        const payload = error?.response?.data ?? error?.message;
        console.error("[API]", method, url, status, payload, error);

        if (status === 401 && error?.config && !error.config._retried) {
          try {
            const newToken = await getIdToken(true);
            if (newToken) {
              error.config._retried = true;
              error.config.headers = error.config.headers ?? {};
              error.config.headers.Authorization = `Bearer ${newToken}`;
              return axios(error.config);
            }
          } catch {
            // Keep the original 401 flow when token refresh fails.
          }
        }

        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptorId);
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  return null;
}
