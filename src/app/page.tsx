import Dashboard from "@/components/dashboard";
import { getDashboard } from "@/lib/market-data";

export const revalidate = 900;

export default async function Home() {
  const data = await getDashboard();
  return <Dashboard initialData={data} />;
}
