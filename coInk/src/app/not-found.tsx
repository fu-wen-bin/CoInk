'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground selection:bg-gray-500/30">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background [background-image:radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:[background-image:radial-gradient(#1f2937_1px,transparent_1px)] opacity-50"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full text-center"
      >
        <h1 className="mb-4 text-8xl font-bold tracking-tighter sm:text-9xl bg-gradient-to-t from-transparent via-red-500 to-red-600 bg-clip-text text-transparent">
          404
        </h1>

        <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl text-gray-600 dark:text-gray-400">
          Page not found
        </h2>

        <p className="mb-10 text-muted-foreground leading-relaxed">
          抱歉，我们找不到您要查找的页面。它可能已被移动、删除或从未存在过。
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="h-12 gap-2 rounded-full px-8 text-base shadow-lg hover:shadow-gray-500/20 bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white border-0 transition-all duration-300"
          >
            <Link href="/">
              <Home className="h-4 w-4" />
              返回首页
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-12 gap-2 rounded-full px-8 text-base bg-transparent hover:bg-gray-100/50 dark:hover:bg-gray-800/50 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </Button>
        </div>
      </motion.div>

      <div className="absolute bottom-8 text-center text-xs text-muted-foreground/50">
        <p>CoInk &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
