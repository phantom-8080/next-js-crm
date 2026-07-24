import "./globals.css";
import { Geist } from "next/font/google";
import type { Viewport } from "next";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const themeInitScript = `(function(){try{var q=new URLSearchParams(location.search).get("theme");var t=(q==="dark"||q==="light")?q:null;if(!t){try{t=localStorage.getItem("crm-theme-v1")}catch(e){}}if(t!=="dark"&&t!=="light"){var m=document.cookie.match(/(?:^|; )crm-theme-v1=([^;]*)/);var c=m?decodeURIComponent(m[1]):null;t=(c==="dark"||c==="light")?c:"light"}if(t==="dark"){document.documentElement.classList.add("dark")}else{document.documentElement.classList.remove("dark")}if(q==="dark"||q==="light"){try{localStorage.setItem("crm-theme-v1",q)}catch(e){}try{document.cookie="crm-theme-v1="+encodeURIComponent(q)+"; Path=/; Max-Age=31536000; SameSite=Lax"}catch(e){}}}catch(e){}})();`;

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
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
