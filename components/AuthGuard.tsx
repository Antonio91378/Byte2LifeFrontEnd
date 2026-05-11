"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

const PUBLIC_PATHS = ["/login", "/allowanonimos"];

interface AuthGuardProps {
  children: React.ReactNode;
  publicSlot?: React.ReactNode;
}

export default function AuthGuard({ children, publicSlot }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      const next =
        pathname && pathname !== "/"
          ? `?next=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${next}`);
    }
  }, [user, loading, isPublic, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-purple/25 border-t-brand-purple" />
      </div>
    );
  }

  if (isPublic) {
    return <>{publicSlot}</>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
