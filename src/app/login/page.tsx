'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Mail, Lock, Zap, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            router.push('/dashboard');
            router.refresh();
        } catch (err) {
            setError('Ocorreu um erro ao tentar fazer login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-brand-500/30">
            <style jsx>{`
                @keyframes float-particle {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    20% { opacity: 0.5; }
                    80% { opacity: 0.5; }
                    100% { transform: translateY(-100px) translateX(50px); opacity: 0; }
                }
            `}</style>

            {/* Extended Animated Tech Background */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                {/* Mouse Follower Spotlight */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(1200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(178, 245, 139, 0.06), transparent 50%)`,
                    }}
                />

                {/* Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                        backgroundSize: '40px 40px',
                        maskImage: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 70%)`
                    }}
                />

                {/* Layer 1: Large Base Orbs (Slow movement) */}
                <div
                    className="absolute w-[800px] h-[800px] bg-brand-500/5 rounded-full blur-[140px] animate-pulse duration-[8000ms]"
                    style={{
                        top: '-10%',
                        left: '-10%',
                        transform: `translate(${mousePos.x * -0.01}px, ${mousePos.y * -0.01}px)`
                    }}
                />
                <div
                    className="absolute w-[700px] h-[700px] bg-blue-600/5 rounded-full blur-[140px] animate-pulse duration-[10000ms]"
                    style={{
                        bottom: '-10%',
                        right: '-10%',
                        transform: `translate(${mousePos.x * 0.01}px, ${mousePos.y * 0.01}px)`
                    }}
                />

                {/* Layer 2: Medium Floating Orbs (Medium movement) */}
                <div
                    className="absolute w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] transition-transform duration-700 ease-out"
                    style={{
                        top: '40%',
                        right: '10%',
                        transform: `translate(${mousePos.x * -0.03}px, ${mousePos.y * 0.03}px)`
                    }}
                />
                <div
                    className="absolute w-[300px] h-[300px] bg-brand-400/5 rounded-full blur-[80px] transition-transform duration-500 ease-out"
                    style={{
                        bottom: '30%',
                        left: '20%',
                        transform: `translate(${mousePos.x * 0.02}px, ${mousePos.y * -0.02}px)`
                    }}
                />

                {/* Layer 3: Reactive Particles (Fast movement) */}
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full blur-[1px] transition-transform duration-200 ease-linear"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: Math.random() * 0.5 + 0.2,
                            transform: `translate(${mousePos.x * (Math.random() * 0.05 - 0.025)}px, ${mousePos.y * (Math.random() * 0.05 - 0.025)}px)`,
                            boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                        }}
                    />
                ))}

                {/* Layer 4: "Fireflies" - drifting upwards */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 bg-brand-400 rounded-full blur-[2px] animate-bounce duration-[3000ms] opacity-40" />
                    <div className="absolute bottom-1/3 right-1/3 w-1 h-1 bg-blue-400 rounded-full blur-[1px] animate-ping duration-[4000ms] opacity-30" />
                </div>
            </div>

            <div className="w-full max-w-md relative z-10 p-4">
                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 hover:ring-brand-500/20 transition-all duration-500">
                    <div className="p-8 relative">
                        {/* Subtle Top Gradient */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent opacity-30" />

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/20 group">
                                <Zap className="w-8 h-8 text-zinc-900" />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Creatye</h1>
                            <p className="text-zinc-400 text-sm mt-2 font-medium">Console de Automação Inteligente</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <button
                                id="btn-google-login"
                                type="button"
                                onClick={async () => {
                                    await supabase.auth.signInWithOAuth({
                                        provider: 'google',
                                        options: {
                                            redirectTo: `${window.location.origin}/auth/callback`,
                                        },
                                    })
                                }}
                                className="w-full flex items-center justify-center py-3 px-4 border border-zinc-800 rounded-xl bg-zinc-950/50 hover:bg-zinc-900 text-zinc-300 text-sm font-medium transition-colors group"
                            >
                                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Entrar com Google
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-zinc-800"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-zinc-950 px-2 text-zinc-500">Ou continue com email</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider pl-1">Email Corporativo</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-zinc-600 group-focus-within:text-brand-400 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="block w-full pl-10 pr-3 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-zinc-200 placeholder:text-zinc-700 transition-all text-sm font-medium"
                                        placeholder="admin@empresa.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider pl-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-zinc-600 group-focus-within:text-brand-400 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="block w-full pl-10 pr-3 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-zinc-200 placeholder:text-zinc-700 transition-all text-sm font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-500/10 text-sm font-bold text-zinc-900 bg-brand-500 hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-brand-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Entrar na Plataforma
                                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center pt-6 border-t border-zinc-800/50">
                            <p className="text-zinc-600 text-sm">
                                Ainda não tem conta?{' '}
                                <Link href="/register" className="text-brand-400 hover:text-brand-300 font-bold hover:underline transition-colors decoration-brand-500/30 underline-offset-4">
                                    Crie agora
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-zinc-700 text-xs mt-8">
                    &copy; 2024 Creatye Automation.
                </p>
            </div>
        </div>
    );
}
