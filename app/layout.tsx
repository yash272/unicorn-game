import type { Metadata } from 'next';
import './globals.css';
import './funnel.css';
export const metadata: Metadata = {title:'UNICORN: The Startup Card Game',description:'Build a billion-dollar startup. Betray your friends along the way. A card game for 3–5 players, coming to Kickstarter. Get the launch alert.',openGraph:{title:'UNICORN: The Startup Card Game',description:'Build a billion-dollar startup. Betray your friends along the way.',url:'https://unicorn-game.yvs272.workers.dev/',images:[{url:'https://unicorn-game.yvs272.workers.dev/images/playtest/trailer-poster.webp',width:1280,height:720}]},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="preload" href="/fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B47b1_3E.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head><body>{children}</body></html>}
