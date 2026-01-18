import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <SettingsClient />
        </Suspense>
    );
}
