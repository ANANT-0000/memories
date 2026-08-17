import PinScreen from "@/components/PinScreen";

export const metadata = {
  title: "Unlock Gallery",
  description: "Enter your PIN to access the gallery.",
  robots: "noindex", // don't index the lock page
};

export default function LockPage() {
  return <PinScreen />;
}
