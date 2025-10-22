import "@/styles/globals.css";
// import 'reactflow/dist/style.css';
import GlobalNav from "@/components/GlobalNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <ThemeProvider>
    <Component {...pageProps} />
    <GlobalNav />
  </ThemeProvider>
}
