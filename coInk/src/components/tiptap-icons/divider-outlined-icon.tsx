import { memo } from 'react';

type SvgProps = React.ComponentPropsWithoutRef<'svg'>;

/** Ant Design DividerOutlined 风格：中间横线 + 四角点，用于所有「分割线」相关 UI */
export const DividerOutlinedIcon = memo(({ className, ...props }: SvgProps) => {
  return (
    <svg
      width="1em"
      height="1em"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-icon="DividerOutlined"
      aria-hidden
      {...props}
    >
      <path
        d="M9.5 4a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm0 16a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1ZM3 11a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm14-7a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm1 15a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM2 4a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1Zm1 15a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H3Z"
        fill="currentColor"
      />
    </svg>
  );
});

DividerOutlinedIcon.displayName = 'DividerOutlinedIcon';
