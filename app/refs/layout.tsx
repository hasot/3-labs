import { LangProvider } from "./i18n";

export default function RefsLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="min-h-screen bg-[#141414] font-sans text-white">{children}</div>
    </LangProvider>
  );
}
