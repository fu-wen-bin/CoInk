'use client';

import { useCallback, useEffect, useState } from 'react';
import { type Editor, useEditorState } from '@tiptap/react';

import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { TextColorSmallIcon } from '@/components/tiptap-icons/text-color-small-icon';
import { getActiveMarkAttrs } from '@/lib/tiptap-advanced-utils';
import { canColorText } from '@/components/tiptap-ui/color-text-button';
import { canColorHighlight } from '@/components/tiptap-ui/color-highlight-button';

export type ColorType = 'text' | 'highlight';

export interface ColorItem {
  value: string;
  label: string;
}

export interface RecentColor {
  type: ColorType;
  label: string;
  value: string;
}

/**
 * Configuration for the color text popover functionality
 */
export interface UseColorTextPopoverConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null;
  /**
   * Whether the popover should hide when color text is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean;
  /**
   * Callback function called after a color is applied.
   */
  onColorChanged?: ({
    type,
    label,
    value,
  }: {
    type: ColorType;
    label: string;
    value: string;
  }) => void;
}

/**
 * Get a color object by its value
 */
export function getColorByValue(value: string, colorArray: ColorItem[]): ColorItem {
  return (
    colorArray.find((color) => color.value === value) ?? {
      value,
      label: value,
    }
  );
}

/**
 * Checks if color text popover should be shown
 */
export function shouldShowColorTextPopover(params: {
  editor: Editor | null;
  hideWhenUnavailable: boolean;
}): boolean {
  const { editor, hideWhenUnavailable } = params;

  if (!editor || !editor.isEditable) return false;

  if (hideWhenUnavailable && !editor.isActive('code')) {
    return canColorText(editor) || canColorHighlight(editor);
  }

  return true;
}

/**
 * Hook to manage recently used colors
 */
export function useRecentColors(maxColors: number = 3) {
  const [recentColors, setRecentColors] = useState<RecentColor[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedColors = localStorage.getItem('tiptapRecentlyUsedColors');
      if (storedColors) {
        const colors = JSON.parse(storedColors) as RecentColor[];
        setRecentColors(colors.slice(0, maxColors));
      }
    } catch (e) {
      console.error('Failed to load stored colors:', e);
    } finally {
      setIsInitialized(true);
    }
  }, [maxColors]);

  const addRecentColor = useCallback(
    ({ type, label, value }: { type: ColorType; label: string; value: string }) => {
      setRecentColors((prevColors) => {
        const filtered = prevColors.filter((c) => !(c.type === type && c.value === value));
        const updated = [{ type, label, value }, ...filtered].slice(0, maxColors);

        try {
          localStorage.setItem('tiptapRecentlyUsedColors', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to store colors:', e);
        }

        return updated;
      });
    },
    [maxColors],
  );

  return { recentColors, addRecentColor, isInitialized };
}

/**
 * Custom hook that provides color text popover functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage - no params needed
 * function MySimpleColorTextPopover() {
 *   const { isVisible, handleColorChanged } = useColorTextPopover()
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <Popover>
 *       <PopoverTrigger asChild>
 *         <button>Color Text</button>
 *       </PopoverTrigger>
 *       <PopoverContent>
 *         <TextStyleColorPanel onColorChanged={handleColorChanged} />
 *       </PopoverContent>
 *     </Popover>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedColorTextPopover() {
 *   const {
 *     isVisible,
 *     activeTextStyle,
 *     activeHighlight,
 *     handleColorChanged,
 *     label,
 *     Icon,
 *   } = useColorTextPopover({
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onColorChanged: ({ type, label, value }) => console.log('Color changed!', { type, label, value })
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <Popover>
 *       <PopoverTrigger asChild>
 *         <Button
 *           disabled={isDisabled}
 *           aria-label={label}
 *         >
 *           <Icon style={{ color: activeTextStyle.color }} />
 *         </Button>
 *       </PopoverTrigger>
 *       <PopoverContent>
 *         <TextStyleColorPanel onColorChanged={handleColorChanged} />
 *       </PopoverContent>
 *     </Popover>
 *   )
 * }
 * ```
 */
export function useColorTextPopover(config?: UseColorTextPopoverConfig) {
  const { editor: providedEditor, hideWhenUnavailable = false, onColorChanged } = config || {};

  const { editor } = useTiptapEditor(providedEditor);

  const colorUi = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) {
        return {
          isVisible: false,
          activeTextStyle: {} as Record<string, unknown>,
          activeHighlight: {} as Record<string, unknown>,
          canToggle: false,
        };
      }
      return {
        isVisible: shouldShowColorTextPopover({
          editor: ed,
          hideWhenUnavailable,
        }),
        activeTextStyle: getActiveMarkAttrs(ed, 'textStyle') || {},
        activeHighlight: getActiveMarkAttrs(ed, 'highlight') || {},
        canToggle: canColorText(ed) || canColorHighlight(ed),
      };
    },
  });

  const isVisible = colorUi?.isVisible ?? false;
  const activeTextStyle = colorUi?.activeTextStyle ?? {};
  const activeHighlight = colorUi?.activeHighlight ?? {};
  const canToggle = colorUi?.canToggle ?? false;

  const handleColorChanged = useCallback(
    ({ type, label, value }: { type: ColorType; label: string; value: string }) => {
      onColorChanged?.({ type, label, value });
    },
    [onColorChanged],
  );

  return {
    isVisible,
    canToggle,
    activeTextStyle,
    activeHighlight,
    handleColorChanged,
    label: '文字颜色',
    Icon: TextColorSmallIcon,
  };
}
