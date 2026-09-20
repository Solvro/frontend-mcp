import { Landing } from "@/components/Landing";
import { AuthProvider } from "@/lib/useAuth";

export default function Home() {
  return (
    <AuthProvider>
      <Landing />
    </AuthProvider>
  );
}
