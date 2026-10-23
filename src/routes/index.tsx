import { createFileRoute } from "@tanstack/react-router";
import { FloraConsole } from "@/components/flora-console";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FloraConsole />;
}

