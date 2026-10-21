import {
  createElement,
  useEffect,
  useRef,
  type ReactElement,
  CSSProperties,
} from "react";
import {
  createEditor,
  createPreview,
  type EditorHandle,
  type EditorOptions,
  type PreviewHandle,
  type PreviewOptions,
} from "../dom/index.js";
type ContainerProps = { className?: string; style?: CSSProperties };
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
  useEffect(() => {
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
