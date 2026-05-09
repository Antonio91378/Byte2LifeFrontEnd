"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export default function LogoutButton({
  className = "",
  label = "Sair",
}: LogoutButtonProps) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`flex items-center gap-1 transition-colors ${className}`}
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  );
}
