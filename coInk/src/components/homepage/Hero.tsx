import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';

interface HeroProps {
  isMounted: boolean;
  isLoggedIn: boolean;
  onGetStarted: () => void;
}

const Hero: React.FC<HeroProps> = ({ isLoggedIn, onGetStarted }) => {
  return (
    <section className="relative px-6 flex items-center justify-center min-h-[calc(100vh-120px)]">
      <div className="max-w-7xl mx-auto text-center relative z-10 w-full">
        {/* 主标题部分 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-12"
        >
          <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-xl text-white px-4 py-2 rounded-full border border-white/10 mb-6">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">基于 Tiptap + Yjs 构建的 AI 写作平台</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-emerald-200 to-green-200 bg-clip-text text-transparent">
              CoInk
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent">
              AI 智能写作平台
            </span>
          </h1>

          <p className="text-lg text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            基于 Tiptap + Yjs 构建的新一代智能协作编辑器，集成 AI
            续写功能。支持多人实时协作编辑，让团队像使用 Google Docs 一样流畅协作，同时拥有强大的 AI
            能力加持。
            <br />
            <span className="text-gray-400 mt-2 block">
              无论是文档写作、知识管理还是内容创作，CoInk
              都能让你的工作效率成倍提升，让创意与技术完美融合
            </span>
          </p>

          {/* 行动按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <motion.button
              onClick={onGetStarted}
              className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 text-white font-semibold rounded-2xl shadow-2xl hover:shadow-emerald-500/40 transition-all duration-300 cursor-pointer overflow-hidden"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center justify-center space-x-2 text-lg">
                <Sparkles className="h-5 w-5" />
                <span>{isLoggedIn ? '开始创作' : '登录立即创作'}</span>
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
