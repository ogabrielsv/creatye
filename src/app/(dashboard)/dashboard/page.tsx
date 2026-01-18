import { redirect } from 'next/navigation';

export default function DashboardPage() {
    // For now, redirect to automations or show empty dashboard
    redirect('/automations');

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p>Bem-vindo ao Creatye.</p>
        </div>
    );
}
