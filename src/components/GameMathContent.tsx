import { createElement, Fragment, useMemo, type ReactNode } from 'react';
import type { GameContentPart } from '../data/towerConfig';

const namespace = 'http://www.w3.org/1998/Math/MathML';
const elements = new Set(
  'math mrow mi mn mo mtext mspace mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mfenced mstyle menclose mpadded mphantom mmultiscripts mprescripts none semantics annotation merror'.split(' '),
);
const attributes = new Set(
  'display dir mathvariant mathsize mathcolor mathbackground displaystyle scriptlevel stretchy symmetric fence separator lspace rspace minsize maxsize accent accentunder largeop movablelimits form linethickness bevelled width height depth open close separators columnalign rowalign columnspacing rowspacing columnlines rowlines columnspan rowspan frame framespacing notation voffset lquote rquote encoding'.split(' '),
);

function mathNode(element: Element, key: number, depth = 0): ReactNode {
  if (depth > 40 || element.namespaceURI !== namespace || !elements.has(element.localName)) {
    throw new Error('Invalid MathML');
  }
  const props: Record<string, string | number> = { key };
  for (const attribute of Array.from(element.attributes)) {
    if (!attribute.namespaceURI && attributes.has(attribute.name) &&
        attribute.value.length <= 128 && !/[<>]|url\s*\(/i.test(attribute.value)) {
      props[attribute.name] = attribute.value;
    }
  }
  if (depth === 0) props.display = 'inline';
  return createElement(element.localName, props, Array.from(element.childNodes, (child, index) =>
    child.nodeType === 1 ? mathNode(child as Element, index, depth + 1) : child.textContent,
  ));
}

interface Props {
  content?: GameContentPart[];
  fallback: ReactNode;
}

export function GameMathContent({ content, fallback }: Props) {
  const rendered = useMemo(() => {
    if (!Array.isArray(content) || content.length > 32 || typeof DOMParser === 'undefined') return null;
    try {
      return content.map((part, index) => {
        if (part.kind === 'text') return <Fragment key={index}>{part.value}</Fragment>;
        if (part.kind !== 'math' || part.value.length > 8000) throw new Error('Invalid formula');
        const document = new DOMParser().parseFromString(part.value, 'application/xml');
        if (document.doctype || document.documentElement.localName !== 'math') throw new Error('Invalid formula');
        return <bdi key={index} className="game-inline-equation">{mathNode(document.documentElement, 0)}</bdi>;
      });
    } catch {
      return null;
    }
  }, [content]);

  return rendered?.length ? <span dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{rendered}</span> : fallback;
}
