import "@/styles/globals.css";
// import 'reactflow/dist/style.css';
import GlobalNav from "@/components/GlobalNav";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <>
    <Component {...pageProps} />;
    <GlobalNav />
  </>
}
