import { verifyAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyAuth();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 p-8">{children}</main>
    </div>
  );
}
