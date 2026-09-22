import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'UNICORN: Build. Raise. Hire. Attack.',description:'Build a startup. Sabotage your friends. First to $1B wins. UNICORN is a strategic card game for 3–5 players. Join the first playtest.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
