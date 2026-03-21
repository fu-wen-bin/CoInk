import { Group } from './types';

export const GROUPS: Group[] = [
  {
    name: 'format',
    title: '样式',
    commands: [
      {
        name: 'heading1',
        label: '一级标题',
        iconName: 'Heading1',
        description: '最高优先级章节标题',
        aliases: ['h1'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 1 }).run();
        },
      },
      {
        name: 'heading2',
        label: '二级标题',
        iconName: 'Heading2',
        description: '中等优先级章节标题',
        aliases: ['h2'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 2 }).run();
        },
      },
      {
        name: 'heading3',
        label: '三级标题',
        iconName: 'Heading3',
        description: '较低优先级章节标题',
        aliases: ['h3'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 3 }).run();
        },
      },
      {
        name: 'heading4',
        label: '四级标题',
        iconName: 'Heading4',
        description: '子章节标题',
        aliases: ['h4'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 4 }).run();
        },
      },
      {
        name: 'heading5',
        label: '五级标题',
        iconName: 'Heading5',
        description: '次级章节标题',
        aliases: ['h5'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 5 }).run();
        },
      },
      {
        name: 'heading6',
        label: '六级标题',
        iconName: 'Heading6',
        description: '最小级别标题',
        aliases: ['h6'],
        action: (editor) => {
          editor.chain().focus().setHeading({ level: 6 }).run();
        },
      },
      {
        name: 'bulletList',
        label: '无序列表',
        iconName: 'List',
        description: '无序条目列表',
        aliases: ['ul'],
        action: (editor) => {
          editor.chain().focus().toggleBulletList().run();
        },
      },
      {
        name: 'numberedList',
        label: '有序列表',
        iconName: 'ListOrdered',
        description: '有序条目列表',
        aliases: ['ol'],
        action: (editor) => {
          editor.chain().focus().toggleOrderedList().run();
        },
      },
      {
        name: 'taskList',
        label: '任务列表',
        iconName: 'ListTodo',
        description: '带待办项的任务列表',
        aliases: ['todo'],
        action: (editor) => {
          editor.chain().focus().toggleTaskList().run();
        },
      },
      {
        name: 'toggleList',
        label: '折叠列表',
        iconName: 'ListCollapse',
        description: '可展开/折叠显示内容',
        aliases: ['toggle'],
        action: (editor) => {
          editor.chain().focus().setDetails().run();
        },
      },
      {
        name: 'blockquote',
        label: '引用',
        iconName: 'Quote',
        description: '用于引用内容',
        action: (editor) => {
          editor.chain().focus().toggleBlockquote().run();
        },
      },
      {
        name: 'codeBlock',
        label: '代码块',
        iconName: 'SquareCode',
        description: '带语法高亮的代码块',
        shouldBeHidden: (editor) => editor.isActive('columns'),
        action: (editor) => {
          editor.chain().focus().toggleCodeBlock().run();
        },
      },
    ],
  },
  {
    name: 'insert',
    title: '插入',
    commands: [
      {
        name: 'table',
        label: '表格',
        iconName: 'Table',
        description: '插入一个表格',
        shouldBeHidden: (editor) => editor.isActive('columns'),
        action: (editor) => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
        },
      },
      {
        name: 'mathFormula',
        label: '数学公式',
        iconName: 'Sigma',
        description: '插入数学公式（行内或块级）',
        aliases: ['math', 'formula', 'equation', 'latex', '公式', '数学'],
        action: (editor) => {
          editor.chain().focus().openMathLiveEditor().run();
        },
      },
      {
        name: 'image',
        label: '图片',
        iconName: 'Image',
        description: '插入一张图片',
        aliases: ['img'],
        action: (editor) => {
          editor.chain().focus().setImageUpload().run();
        },
      },
      {
        name: 'columns',
        label: '分栏',
        iconName: 'Columns2',
        description: '添加双栏内容',
        aliases: ['cols'],
        shouldBeHidden: (editor) => editor.isActive('columns'),
        action: (editor) => {
          editor
            .chain()
            .focus()
            .setColumns(2)
            .updateAttributes('columns', { rows: 2 })
            .focus(editor.state.selection.head - 1)
            .run();
        },
      },
      {
        name: 'horizontalRule',
        label: '分割线',
        iconName: 'Minus',
        description: '插入水平分隔线',
        aliases: ['hr'],
        action: (editor) => {
          editor.chain().focus().setHorizontalRule().run();
        },
      },
      {
        name: 'toc',
        label: '目录',
        iconName: 'Book',
        aliases: ['outline'],
        description: '插入文档目录',
        shouldBeHidden: (editor) => editor.isActive('columns'),
        action: (editor) => {
          editor.chain().focus().insertTableOfContents().run();
        },
      },
      {
        name: 'youtube',
        label: 'YouTube 视频',
        iconName: 'Youtube',
        description: '插入 YouTube 视频',
        aliases: ['video', 'yt'],
        action: (editor) => {
          // 触发 YouTube 弹窗事件
          const event = new CustomEvent('openYoutubeDialog', { detail: { editor } });
          window.dispatchEvent(event);
        },
      },
      {
        name: 'bilibili',
        label: 'Bilibili 视频',
        iconName: 'Tv',
        description: '插入 Bilibili 视频',
        aliases: ['bili'],
        action: (editor) => {
          const event = new CustomEvent('openBilibiliDialog', { detail: { editor } });
          window.dispatchEvent(event);
        },
      },
      {
        name: 'chart',
        label: '图表',
        iconName: 'ChartColumnBig',
        description: '插入一个图表',
        aliases: ['chart', 'graph'],
        action: (editor) => {
          editor
            .chain()
            .focus()
            .setChart({
              type: 'bar',
              colorKey: 'red',
              data: [
                {
                  month: '一月',
                  desktop: 186,
                  mobile: 80,
                  tablet: 45,
                },
                {
                  month: '二月',
                  desktop: 305,
                  mobile: 200,
                  tablet: 95,
                },
                {
                  month: '三月',
                  desktop: 237,
                  mobile: 120,
                  tablet: 78,
                },
                {
                  month: '四月',
                  desktop: 73,
                  mobile: 190,
                  tablet: 62,
                },
              ],
              xAxisKey: 'month',
              yAxisKeys: ['desktop'],
              title: '示例图表',
            })
            .run();
        },
      },
      {
        name: 'countdown',
        label: '倒计时',
        iconName: 'Timer',
        description: '插入倒计时',
        aliases: ['countdown'],
        action: (editor) => {
          editor.chain().focus().setCountdown({ targetDate: '' }).run();
        },
      },
    ],
  },
];

export default GROUPS;
