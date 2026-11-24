/** Browser visibility gates for expandable sensor previews. */
import { useEffect, useState } from 'react'

/** Track the accordion and document visibility for on-demand sensor sampling.
 * @returns Expansion, document visibility and the expansion setter.
 */
export function usePreviewVisibility() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const change = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  return { open, visible, setOpen }
}
