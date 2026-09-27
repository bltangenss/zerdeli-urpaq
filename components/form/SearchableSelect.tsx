"use client";

import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { cn } from "@/lib/cn";

export type SearchableOption = { id: string; name: string };

function normalizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("kk-KZ")
    .replace(/(?:№|no\.?)\s*(?=\d)/gu, "no")
    .replace(/\s+/gu, " ")
    .trim();
}

type SearchableSelectProps = {
  id: string;
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  required?: boolean;
  triggerRef?: (node: HTMLButtonElement | null) => void;
  onBlur?: () => void;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  invalid,
  required,
  triggerRef,
  onBlur,
  onChange
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(normalizeSearch(query));
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setTriggerButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerButtonRef.current = node;
      triggerRef?.(node);
    },
    [triggerRef]
  );
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(
    () =>
      options
        .filter((option) => normalizeSearch(option.name).includes(deferredQuery))
        .slice(0, 100),
    [deferredQuery, options]
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
        window.requestAnimationFrame(() => triggerButtonRef.current?.focus());
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !filtered[activeIndex]) return;
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, listboxId, open]);

  function choose(option: SearchableOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerButtonRef.current?.focus());
  }

  return (
    <div className="search-select-root" ref={rootRef}>
      <button
        ref={setTriggerButtonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        aria-busy={loading || undefined}
        disabled={disabled}
        onBlur={onBlur}
        className={cn("select-trigger", invalid && "control-invalid")}
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
          } else {
            setActiveIndex(0);
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={cn(!selected && "control-placeholder")}>{selected?.name ?? placeholder}</span>
        {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {open ? (
        <div className="select-popover" role="presentation">
          <div className="select-search">
            <Search aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter" && filtered[activeIndex]) {
                  event.preventDefault();
                  choose(filtered[activeIndex]);
                } else if (event.key === "Tab") {
                  setOpen(false);
                  setQuery("");
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            />
          </div>
          <div id={listboxId} role="listbox" className="select-options">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={option.id === value}
                  className={cn("select-option", index === activeIndex && "select-option-active")}
                  key={option.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.name}</span>
                  {option.id === value ? <Check aria-hidden="true" /> : null}
                </button>
              ))
            ) : (
              <p className="select-empty">{emptyText}</p>
            )}
          </div>
          {options.length > 100 && filtered.length === 100 ? (
            <p className="select-hint">Нәтижені нақтылау үшін мектеп атауын жазыңыз</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
