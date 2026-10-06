import type { Metadata } from 'next';
import './globals.css';
import './funnel.css';
export const metadata: Metadata = {title:'UNICORN: The Startup Card Game',description:'Build a startup. Betray your friends. A card game for 3–5 players, coming to Kickstarter. Get the launch alert.',openGraph:{title:'UNICORN: The Startup Card Game',description:'Build a startup. Betray your friends.',url:'https://www.unicornthegame.com/',images:[{url:'https://www.unicornthegame.com/images/playtest/trailer-poster.webp',width:1280,height:720}]},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="preload" href="/fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B47b1_3E.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head><body>{children}</body></html>}
