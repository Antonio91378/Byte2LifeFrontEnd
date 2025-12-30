import Link from "next/link";
import Dashboard from "../components/Dashboard";

export default function Home() {
  return (
    <div className="space-y-12 py-8">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-extrabold text-brand-purple tracking-tight">
          Byte<span className="text-brand-orange">2</span>Life
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Plataforma de gerenciamento inteligente para sua produção de impressão 3D.
        </p>
      </header>

      <div className="px-4">
        <Dashboard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
        <Link href="/filaments" className="group relative">
          <div className="absolute inset-0 bg-brand-purple rounded-2xl transform translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3 opacity-20"></div>
          <div className="relative p-8 bg-white rounded-2xl shadow-xl border border-gray-100 hover:border-brand-purple/30 transition-all h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-brand-purple group-hover:text-white transition-colors text-brand-purple">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Filamentos</h2>
            <p className="text-gray-500 leading-relaxed">
              Gerencie seu estoque de materiais. Acompanhe cores, quantidades e custos em tempo real.
            </p>
          </div>
        </Link>

        <Link href="/sales" className="group relative">
          <div className="absolute inset-0 bg-brand-orange rounded-2xl transform translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3 opacity-20"></div>
          <div className="relative p-8 bg-white rounded-2xl shadow-xl border border-gray-100 hover:border-brand-orange/30 transition-all h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-brand-orange group-hover:text-white transition-colors text-brand-orange">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Vendas</h2>
            <p className="text-gray-500 leading-relaxed">
              Controle total sobre seus pedidos. Visualize lucros, status de entrega e pagamentos.
            </p>
          </div>
        </Link>

        <Link href="/budget" className="group relative">
          <div className="absolute inset-0 bg-teal-500 rounded-2xl transform translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3 opacity-20"></div>
          <div className="relative p-8 bg-white rounded-2xl shadow-xl border border-gray-100 hover:border-teal-500/30 transition-all h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-teal-500 group-hover:text-white transition-colors text-teal-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Simulação</h2>
            <p className="text-gray-500 leading-relaxed">
              Faça orçamentos precisos. Calcule custos e lucros baseados em material, tempo e qualidade.
            </p>
          </div>
        </Link>

        <Link href="/investments" className="group relative">
          <div className="absolute inset-0 bg-red-500 rounded-2xl transform translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3 opacity-20"></div>
          <div className="relative p-8 bg-white rounded-2xl shadow-xl border border-gray-100 hover:border-red-500/30 transition-all h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-red-500 group-hover:text-white transition-colors text-red-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Investimentos</h2>
            <p className="text-gray-500 leading-relaxed">
              Acompanhe o ROI do seu negócio. Compare lucros vs investimentos e saiba quando atingirá o break-even.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
