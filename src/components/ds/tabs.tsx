"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TabItem = {
  id: string;
  label: ReactNode;
  /** Mono count rendered after the label. */
  count?: number | string;
  /** Optional panel content; omit to use Tabs as a bar only. */
  content?: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  vertical?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  vertical = false,
  className,
  style,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id ?? "");
  const active = value ?? internal;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [seam, setSeam] = useState<{ left: number; width: number } | null>(
    null,
  );
  // Instance-scoped id prefix so tab/panel ids never collide across instances.
  const idBase = useId();
  const tabDomId = (id: string) => `${idBase}-tab-${id}`;
  const panelDomId = (id: string) => `${idBase}-panel-${id}`;

  const positionSeam = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const tab = list.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(active)}"]`,
    );
    if (!tab) {
      setSeam(null);
      return;
    }
    setSeam({ left: tab.offsetLeft, width: tab.offsetWidth });
  }, [active]);

  useEffect(() => {
    positionSeam();
    window.addEventListener("resize", positionSeam);
    return () => window.removeEventListener("resize", positionSeam);
  }, [positionSeam]);

  const activeItem = items.find((item) => item.id === active);

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };

  // Roving-tabindex keyboard support: Arrow keys cycle, Home/End jump;
  // selection follows focus (same effect as a click on the landed tab).
  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    id: string,
  ) => {
    const { key } = event;
    let target: string | undefined;
    if (key === "ArrowRight" || key === "ArrowDown") {
      const idx = items.findIndex((item) => item.id === id);
      target = items[(idx + 1) % items.length]?.id;
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      const idx = items.findIndex((item) => item.id === id);
      target = items[(idx - 1 + items.length) % items.length]?.id;
    } else if (key === "Home") {
      target = items[0]?.id;
    } else if (key === "End") {
      target = items[items.length - 1]?.id;
    } else {
      return;
    }
    event.preventDefault();
    if (target === undefined) return;
    select(target);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(target)}"]`)
      ?.focus();
  };

  const classes = [
    "tsws-tabs",
    vertical ? "tsws-tabs--vertical" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      <div
        className="tsws-tabs__list"
        role="tablist"
        aria-orientation={vertical ? "vertical" : undefined}
        ref={listRef}
      >
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-tab-id={item.id}
              id={tabDomId(item.id)}
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={item.content ? panelDomId(item.id) : undefined}
              className={
                isActive
                  ? "tsws-tabs__tab tsws-tabs__tab--active"
                  : "tsws-tabs__tab"
              }
              onClick={() => select(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, item.id)}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="tsws-tabs__tab-count">{item.count}</span>
              ) : null}
            </button>
          );
        })}
        {!vertical && seam ? (
          <span
            className="tsws-tabs__seam"
            style={{ left: seam.left, width: seam.width }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {activeItem?.content !== undefined ? (
        <div
          key={activeItem.id}
          className="tsws-tabs__panel"
          role="tabpanel"
          id={panelDomId(activeItem.id)}
          aria-labelledby={tabDomId(activeItem.id)}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}

export { Tabs };
