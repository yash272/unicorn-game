import type { Metadata } from 'next';
import './globals.css';
import './funnel.css';
import './tabletop.css';
export const metadata: Metadata = {title:'UNICORN: The Startup Card Game',description:'Build a $1B startup. Betray your friends. A physical card game for 3–5 players. Follow UNICORN on Kickstarter.',openGraph:{title:'UNICORN: The Startup Card Game',description:'Build a billion-dollar startup. Betray your friends along the way.',url:'https://www.unicornthegame.com/',images:[{url:'https://www.unicornthegame.com/images/playtest/table-reactions-1200.webp',width:1200,height:900}]},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="preload" href="/fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B47b1_3E.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>}
