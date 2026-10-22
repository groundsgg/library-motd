import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  CSSProperties,
} from "react";
import {
  createEditor,
  createPreview,
  createComparison,
  type ComparisonHandle,
  type ComparisonOptions,
  type EditorHandle,
  type EditorOptions,
  type PreviewHandle,
  type PreviewOptions,
} from "../dom/index.js";
type ContainerProps = { className?: string; style?: CSSProperties };
const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
export function ServerListEditor(
  props: EditorOptions & ContainerProps,
): ReactElement {
  const host = useRef<HTMLDivElement>(null),
    handle = useRef<EditorHandle | null>(null);
  useEffect(() => {
    if (host.current) handle.current = createEditor(host.current, props);
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // Mount once; the effect below applies current props without destroying editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Apply a committed render before another native input event can advance the
  // imperative editor. A passive effect can echo an older document over it.
  useClientLayoutEffect(() => {
    handle.current?.update(props);
  });
  return createElement("div", {
    ref: host,
    className: props.className,
    style: props.style,
  });
}
export function ServerListPreview(
  props: PreviewOptions & ContainerProps,
): ReactElement {
  const host = useRef<HTMLDivElement>(null),
    handle = useRef<PreviewHandle | null>(null);
  useEffect(() => {
    if (host.current) handle.current = createPreview(host.current, props);
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // Mount once; the effect below applies current props without destroying editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    handle.current?.update(props);
  });
  return createElement("div", {
    ref: host,
    className: props.className,
    style: props.style,
  });
}

export function ServerListComparison(
  props: ComparisonOptions & ContainerProps,
): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ComparisonHandle | null>(null);
  useEffect(() => {
    if (host.current) handle.current = createComparison(host.current, props);
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // Mount once; updates keep independently keyed client previews alive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    handle.current?.update(props);
  });
  return createElement("div", {
    ref: host,
    className: props.className,
    style: props.style,
  });
}
