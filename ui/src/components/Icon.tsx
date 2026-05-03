import { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
}

export const IconCar = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <path d="M3 14 L4.5 8.5 C4.9 7.4 6 6.5 7.2 6.5 L16.8 6.5 C18 6.5 19.1 7.4 19.5 8.5 L21 14 L21 18 C21 18.5 20.6 19 20 19 L18.5 19 C18 19 17.5 18.5 17.5 18 L17.5 17 L6.5 17 L6.5 18 C6.5 18.5 6 19 5.5 19 L4 19 C3.4 19 3 18.5 3 18 Z" />
        <circle cx="7" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
)

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

export const IconStar = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <polygon points="12,3 14.5,9 21,9.5 16,13.8 17.5,20 12,16.5 6.5,20 8,13.8 3,9.5 9.5,9" />
    </svg>
)

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
)

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
)

export const IconChat = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </svg>
)

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
)

export const IconStats = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <line x1="4" y1="20" x2="4" y2="10" />
        <line x1="10" y1="20" x2="10" y2="4" />
        <line x1="16" y1="20" x2="16" y2="14" />
        <line x1="20" y1="20" x2="20" y2="8" />
    </svg>
)

export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <line x1="9" y1="7" x2="9" y2="7" /><line x1="15" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="9" y2="11" /><line x1="15" y1="11" x2="15" y2="11" />
        <line x1="9" y1="15" x2="9" y2="15" /><line x1="15" y1="15" x2="15" y2="15" />
        <line x1="10" y1="21" x2="10" y2="17" /><line x1="14" y1="21" x2="14" y2="17" />
    </svg>
)

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
)

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
)

export const IconSend = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22,2 15,22 11,13 2,9" />
    </svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><polyline points="20 6 9 17 4 12" /></svg>
)

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

export const IconHandshake = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
        <path d="M20.6 13.4a2 2 0 0 0 0-2.8l-7.2-7.2a2 2 0 0 0-1.4-.6H5a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l7.2 7.2a2 2 0 0 0 2.8 0z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
)
