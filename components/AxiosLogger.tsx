"use client";

import { resolveApiUrl } from "@/utils/api";
import axios from "axios";
import { useEffect, useRef } from "react";

export default function AxiosLogger() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const requestInterceptorId = axios.interceptors.request.use((config) => {
      config.url = resolveApiUrl(config.url);
      return config;
    });

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url;
        const method = error?.config?.method?.toUpperCase();
        const payload = error?.response?.data ?? error?.message;
        console.error("[API]", method, url, status, payload, error);
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
