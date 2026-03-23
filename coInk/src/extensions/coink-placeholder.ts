import { isNodeEmpty } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Placeholder, preparePlaceholderAttribute } from '@tiptap/extensions';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * 占位符样式与 DOM 类名一一对应，避免标题（H1–H6）与正文 slash 提示共用类名导致 CSS 互相污染。
 *
 * - `is-placeholder-heading`：仅 heading 节点
 * - `is-placeholder-slash`：仅 paragraph（列表/引用内段落同为 paragraph）
 * - `is-placeholder-default`：其它空文本块（代码块等），展示 `data-placeholder` 原文
 */
function placeholderVariantClass(nodeTypeName: string): string {
  if (nodeTypeName === 'heading') return 'is-placeholder-heading';
  if (nodeTypeName === 'paragraph') return 'is-placeholder-slash';
  return 'is-placeholder-default';
}

function isImageLikeBlock(typeName: string): boolean {
  return typeName === 'image' || typeName === 'imageUpload';
}

/**
 * 文档顶层、与图片类块（image / imageUpload）紧邻的空段落：在**光标不在该段**时不显示占位符，
 * 避免未聚焦时与图片区域视觉抢镜；一旦点击/聚焦该段（hasAnchor），仍显示「输入 '/'」类提示。
 */
function isTopLevelEmptyParagraphNearImage(doc: PmNode, pos: number, node: PmNode): boolean {
  if (node.type.name !== 'paragraph' || !isNodeEmpty(node)) return false;
  let $pos: ReturnType<PmNode['resolve']>;
  try {
    $pos = doc.resolve(pos + 1);
  } catch {
    return false;
  }
  if ($pos.depth !== 1) return false;
  if ($pos.before(1) !== pos) return false;
  const ix = $pos.index(0);
  const prev = ix > 0 ? doc.child(ix - 1) : null;
  const next = ix < doc.childCount - 1 ? doc.child(ix + 1) : null;
  return (
    (prev != null && isImageLikeBlock(prev.type.name)) ||
    (next != null && isImageLikeBlock(next.type.name))
  );
}

export const CoInkPlaceholder = Placeholder.extend({
  addProseMirrorPlugins() {
    const dataAttribute = this.options.dataAttribute
      ? `data-${preparePlaceholderAttribute(this.options.dataAttribute)}`
      : 'data-placeholder';

    return [
      new Plugin({
        key: new PluginKey('placeholder'),
        props: {
          decorations: ({ doc, selection }) => {
            const active = this.editor.isEditable || !this.options.showOnlyWhenEditable;
            const { anchor } = selection;
            const decorations: Decoration[] = [];

            if (!active) {
              return null;
            }

            const isEmptyDoc = this.editor.isEmpty;

            doc.descendants((node, pos) => {
              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
              const isEmpty = !node.isLeaf && isNodeEmpty(node);

              if (!node.type.isTextblock) {
                return this.options.includeChildren;
              }

              if ((hasAnchor || !this.options.showOnlyCurrent) && isEmpty) {
                if (isTopLevelEmptyParagraphNearImage(doc, pos, node) && !hasAnchor) {
                  return this.options.includeChildren;
                }

                const variantClass = placeholderVariantClass(node.type.name);
                const classes = [this.options.emptyNodeClass.trim(), variantClass].filter(
                  (c) => c.length > 0,
                );

                if (isEmptyDoc) {
                  classes.push(this.options.emptyEditorClass);
                }

                const decoration = Decoration.node(pos, pos + node.nodeSize, {
                  class: classes.join(' '),
                  [dataAttribute]:
                    typeof this.options.placeholder === 'function'
                      ? this.options.placeholder({
                          editor: this.editor,
                          node,
                          pos,
                          hasAnchor,
                        })
                      : this.options.placeholder,
                });

                decorations.push(decoration);
              }

              return this.options.includeChildren;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
