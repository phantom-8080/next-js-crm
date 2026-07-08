import "./globals.css";
import { Geist } from "next/font/google";
import type { Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const themeInitScript = `(function(){try{var t=localStorage.getItem("crm-theme-v1");if(t==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
