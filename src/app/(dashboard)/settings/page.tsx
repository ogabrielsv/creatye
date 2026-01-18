import { Suspense } from "react";
import dynamic from "next/dynamic";

const SettingsClient = dynamic(() => import("./SettingsClient"), {
    ssr: false,
    loading: () => <div>Carregando...</div>
});

export const dynamicParams = true;

export default function SettingsPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <SettingsClient />
        </Suspense>
    );
}
