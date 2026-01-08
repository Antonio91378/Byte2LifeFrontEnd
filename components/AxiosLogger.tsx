'use client';

import axios from 'axios';
import { useEffect, useRef } from 'react';

export default function AxiosLogger() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url;
        const method = error?.config?.method?.toUpperCase();
        const payload = error?.response?.data ?? error?.message;
        console.error('[API]', method, url, status, payload, error);
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  return null;
}
