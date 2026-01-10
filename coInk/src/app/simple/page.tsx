'use client';

import { useEffect, useState } from 'react'
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"

export default function Page() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null // 或者渲染一个 loading 骨架屏
  }

  return <SimpleEditor />
}
