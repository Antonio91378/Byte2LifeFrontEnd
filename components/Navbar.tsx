'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  CircleDollarSign,
  Home,
  Menu,
  MessageSquareText,
  Package2,
  Palette,
  Printer,
  Upload,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import LogoutButton from './LogoutButton';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Início',
    description: 'Resumo do negócio e atalhos principais.',
    icon: Home,
  },
  {
    href: '/stock',
    label: 'Estoque',
    description: 'Controle de insumos, materiais e entradas.',
    icon: Package2,
  },
  {
    href: '/filaments',
    label: 'Filamentos',
    description: 'Massas, cores e disponibilidade por bobina.',
    icon: Boxes,
  },
  {
    href: '/paints',
    label: 'Tintas',
    description: 'Gestão de tintas e consumíveis de acabamento.',
    icon: Palette,
  },
  {
    href: '/services',
    label: 'Serviços',
    description: 'Catálogo de serviços e composição da operação.',
    icon: Wrench,
  },
  {
    href: '/clients',
    label: 'Clientes',
    description: 'Cadastro e acompanhamento da base de clientes.',
    icon: Users,
  },
  {
    href: '/sales',
    label: 'Vendas',
    description: 'Pedidos, status, pagamentos e entrega.',
    icon: CircleDollarSign,
  },
  {
    href: '/printer',
    label: 'Impressora',
    description: 'Monitoramento da impressora e da fila de produção.',
    icon: Printer,
  },
  {
    href: '/import',
    label: 'Importar',
    description: 'Entradas em lote e cargas auxiliares.',
    icon: Upload,
  },
  {
    href: '/bot-chats',
    label: 'Chats IA',
    description: 'Painel dev com histórico, anexos e remoção de conversas.',
    icon: MessageSquareText,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function prettifyActiveLabel(pathname: string) {
  const activeItem = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  return activeItem?.label || 'Menu';
}

export default function Navbar() {
  const pathname = usePathname();
  const [menuPathname, setMenuPathname] = useState<string | null>(null);
  const isMenuOpen = menuPathname === pathname;

  useEffect(() => {
    if (!isMenuOpen || !window.matchMedia('(max-width: 639px)').matches) {
      return undefined;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isMenuOpen]);

  function closeMenu() {
    setMenuPathname(null);
  }

  function toggleMenu() {
    setMenuPathname((current) => (current === pathname ? null : pathname));
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-brand-purple/92 shadow-[0_18px_48px_-24px_rgba(46,2,73,0.8)] backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="group flex items-center gap-3">
            <div className="rounded-xl bg-brand-orange p-2.5 shadow-lg shadow-brand-orange/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/55 sm:text-[0.7rem]">
                Byte2Life
              </span>
              <span className="block text-lg font-bold tracking-[0.22em] text-white sm:text-xl">
                BYTE<span className="text-brand-orange">2</span>LIFE
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/75 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
              {prettifyActiveLabel(pathname)}
            </div>

            <button
              type="button"
              onClick={toggleMenu}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition-all duration-300 hover:border-brand-orange/40 hover:bg-white/12 hover:text-brand-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
              aria-expanded={isMenuOpen}
              aria-controls="byte2life-menu-panel"
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              <span>{isMenuOpen ? 'Fechar' : 'Menu'}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        id="byte2life-menu-panel"
        className={`grid overflow-hidden transition-all duration-300 ease-out ${
          isMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain border-t border-white/10 bg-[linear-gradient(180deg,rgba(87,10,133,0.24),rgba(46,2,73,0.96))] max-sm:max-h-[calc(100dvh-73px)]">
          <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-white/80 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Navegação principal</p>
                <p className="mt-1 text-sm text-white/65">
                  Menu único para desktop e mobile, com fechamento automático ao navegar.
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-brand-orange/30 bg-brand-orange/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">
                {NAV_ITEMS.length + 1} atalhos
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`group flex items-start gap-3 rounded-3xl border px-4 py-4 transition-all duration-300 ${
                      isActive
                        ? 'border-brand-orange/45 bg-brand-orange/12 text-white shadow-[0_18px_36px_-26px_rgba(255,153,0,0.8)]'
                        : 'border-white/10 bg-white/6 text-white/88 hover:border-brand-orange/30 hover:bg-white/10 hover:shadow-[0_18px_36px_-26px_rgba(0,0,0,0.9)]'
                    }`}
                  >
                    <div className={`rounded-2xl p-2.5 transition-colors duration-300 ${isActive ? 'bg-brand-orange text-white' : 'bg-white/10 text-brand-orange group-hover:bg-brand-orange group-hover:text-white'}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold sm:text-base">{item.label}</span>
                        {isActive && (
                          <span className="rounded-full border border-brand-orange/35 bg-brand-orange/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-orange">
                            atual
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}

              <div className="rounded-3xl border border-white/10 bg-white/6 p-1">
                <LogoutButton
                  label="Sair da sessão"
                  className="w-full rounded-[1.25rem] px-4 py-4 text-sm font-semibold text-white/88 transition-all duration-300 hover:bg-red-500/12 hover:text-red-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
