import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handoff — Interview workspace",
  description: "A calm, reliable interview handoff workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("handoff-theme");if(["warm","ocean","forest","plum"].includes(t))document.documentElement.dataset.theme=t}catch(e){}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
