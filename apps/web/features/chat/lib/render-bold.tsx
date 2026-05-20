import { Fragment, type ReactNode } from 'react';

const BOLD_RE = /\*\*(.+?)\*\*/g;

export function renderBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  text.replace(BOLD_RE, (match, inner: string, offset: number) => {
    if (offset > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, offset)}</Fragment>);
    }
    parts.push(
      <strong key={key++} className="font-semibold">
        {inner}
      </strong>,
    );
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts.length > 0 ? parts : text;
}
