'use client';
import { createClient } from '@/lib/supabase/client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Zap,
    Settings,
    LogOut,
    Bot
} from 'lucide-react';

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: MessageSquare, label: 'Inbox', href: '/inbox' },
    { icon: Users, label: 'CRM', href: '/crm' },
    { icon: Zap, label: 'Automations', href: '/automations' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

import { ModeToggle } from './ThemeToggle';

import { InstagramConnectionStatus } from './InstagramConnectionStatus';

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-background border-r border-border h-screen flex flex-col fixed left-0 top-0 z-50 transition-colors">
            <div className="p-6 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-300 rounded-lg flex items-center justify-center text-zinc-900 shadow-sm">
                        <Zap className="w-5 h-5" />
                    </div>
                    <span className="text-xl font-bold text-foreground">
                        Creatye
                    </span>
                </div>
                {/* Theme Toggle in Header */}
                <ModeToggle />
            </div>

            <InstagramConnectionStatus />

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-300 font-bold border border-brand-200 dark:border-brand-800'
                                : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground group-hover:text-foreground'}`} />
                            <span className="">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border">
                <button
                    onClick={async () => {
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sair da conta</span>
                </button>
            </div>
        </aside>
    );
}
