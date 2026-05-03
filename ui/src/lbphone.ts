// Tynt wrapper-lag rundt lb-phones globale `components.*`-API + andre globale.
// I dev-modus (browser) faller hver funksjon tilbake til en plausibel substitutt
// slik at appen fungerer uten lb-phone tilstede.

const w = window as any
const isFiveM = !!w?.invokeNative

// ---------- popup / context / share / pickers ----------

export type PopUpButton = { title: string; color?: 'red' | 'blue'; cb?: () => void; bold?: boolean }
export type PopUp = {
    title: string
    description?: string
    buttons: PopUpButton[]
    inputs?: Array<Partial<HTMLInputElement> & { onChange?: (v: string) => void; minCharacters?: number; maxCharacters?: number }>
    input?: Partial<HTMLInputElement> & { onChange?: (v: string) => void }
    attachment?: { src: string }
}

export function popUp(p: PopUp) {
    if (isFiveM && w.components?.setPopUp) return w.components.setPopUp(p)
    // Fallback: bruk window.confirm / window.prompt for grunnleggende interaktivitet.
    const inp = p.inputs?.[0] || p.input
    if (inp) {
        const v = window.prompt(p.title + (p.description ? '\n' + p.description : ''))
        inp.onChange?.(v ?? '')
        const confirmBtn = p.buttons.find((b) => b.color !== 'red') || p.buttons[0]
        if (v !== null) confirmBtn?.cb?.()
        return
    }
    const ok = p.buttons.length === 1 ? true : window.confirm(p.title + (p.description ? '\n' + p.description : ''))
    const btn = ok ? (p.buttons.find((b) => b.color !== 'red') || p.buttons[0]) : (p.buttons.find((b) => b.color === 'red') || p.buttons[0])
    btn?.cb?.()
}

export function contextMenu(opts: { title?: string; buttons: PopUpButton[] }) {
    if (isFiveM && w.components?.setContextMenu) return w.components.setContextMenu(opts)
    const choice = window.prompt((opts.title || 'Velg') + ':\n' + opts.buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n'))
    const idx = parseInt(choice || '', 10) - 1
    if (idx >= 0 && idx < opts.buttons.length) opts.buttons[idx].cb?.()
}

export function emojiPicker(onSelect: (emoji: string) => void) {
    if (isFiveM && w.components?.setEmojiPickerVisible) {
        w.components.setEmojiPickerVisible({
            onSelect: (e: any) => onSelect(e?.emoji || ''),
        })
        return
    }
    const v = window.prompt('Skriv emoji:')
    if (v) onSelect(v)
}

export function shareCar(car: { id: number; make: string; model: string; year: number; image?: string }) {
    const note = `Sjekk ut ${car.make} ${car.model} (${car.year}) i Bruktbiler-appen!`
    if (isFiveM && w.components?.setShareComponent) {
        w.components.setShareComponent({
            type: 'note',
            data: { title: `${car.make} ${car.model}`, content: note, timestamp: Date.now() },
        })
        return
    }
    if (navigator.share) navigator.share({ title: `${car.make} ${car.model}`, text: note })
    else window.alert('Delt: ' + note)
}

export function contactSelector(onSelect: (number: string, name?: string) => void) {
    if (isFiveM && w.components?.setContactSelector) {
        w.components.setContactSelector({
            onSelect: (c: any) => onSelect(c?.number || '', c?.firstname || c?.name),
            options: { allowPhoneNumber: true },
        })
        return
    }
    const v = window.prompt('Skriv tlfnr:')
    if (v) onSelect(v)
}

// ---------- camera + gallery ----------

export type CapturedMedia = { url: string; uploadedUrl?: string }

export async function takePhoto(): Promise<CapturedMedia | null> {
    if (isFiveM && w.useCamera) {
        return new Promise((resolve) => {
            w.useCamera(
                async (url: string) => {
                    // Videre opplasting hvis blob er tilgjengelig — `useCamera` returnerer object-URL,
                    // konvertering til blob + uploadMedia gir oss en permanent lenke.
                    let uploaded: string | undefined
                    try {
                        const blob = await fetch(url).then((r) => r.blob())
                        if (w.components?.uploadMedia) {
                            uploaded = await w.components.uploadMedia('Image', blob)
                        }
                    } catch {}
                    resolve({ url: uploaded || url, uploadedUrl: uploaded })
                },
                {
                    default: { type: 'Photo', flash: false, camera: 'rear' },
                    permissions: { toggleFlash: true, flipCamera: true, takePhoto: true, takeVideo: false, takeLandscapePhoto: false },
                }
            )
        })
    }
    // Browser fallback: bruker file-input
    return new Promise((resolve) => {
        const inp = document.createElement('input')
        inp.type = 'file'
        inp.accept = 'image/*'
        inp.capture = 'environment'
        inp.onchange = () => {
            const f = inp.files?.[0]
            resolve(f ? { url: URL.createObjectURL(f) } : null)
        }
        inp.click()
    })
}

export async function pickFromGallery(): Promise<CapturedMedia | null> {
    if (isFiveM && w.components?.setGallery) {
        return new Promise((resolve) => {
            w.components.setGallery({
                includeImages: true, includeVideos: false, allowExternal: true, multiSelect: false,
                onSelect: (data: any) => {
                    const item = Array.isArray(data) ? data[0] : data
                    if (item?.src) resolve({ url: item.src })
                    else resolve(null)
                },
                onCancel: () => resolve(null),
            })
        })
    }
    return new Promise((resolve) => {
        const inp = document.createElement('input')
        inp.type = 'file'
        inp.accept = 'image/*'
        inp.onchange = () => {
            const f = inp.files?.[0]
            resolve(f ? { url: URL.createObjectURL(f) } : null)
        }
        inp.click()
    })
}

// ---------- call / formatting / notifications ----------

export function startCall(number: string) {
    if (isFiveM && w.createCall) {
        w.createCall({ number })
        return
    }
    window.alert('Ringer ' + number + ' (sim)')
}

export function notify(title: string, content?: string) {
    if (isFiveM && w.sendNotification) {
        w.sendNotification({ title, content: content || '', source: w.resourceName })
        return
    }
    // Fallback: konsoll
    console.log('[bruktbiler]', title, content)
}

export function formatPhoneNumber(number: string): string {
    if (isFiveM && w.formatPhoneNumber) return w.formatPhoneNumber(number)
    if (!number) return ''
    const s = String(number).replace(/\s/g, '')
    if (s.length === 8) return s.slice(0, 3) + ' ' + s.slice(3, 5) + ' ' + s.slice(5)
    return s
}

export function openExternalApp(name: string, data?: any) {
    if (isFiveM && w.setApp) {
        w.setApp(data ? { name, data } : name)
    }
}
