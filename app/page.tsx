import { redirect } from "next/navigation";

export default function Home() {
  console.log("Current Environment:", process.env.NODE_ENV); // ✅ Add this line

  redirect("/login");
}
