import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

type AutoGrowTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

/** A textarea that grows to fit its content instead of clipping it behind an internal
 * scrollbar — used for the SOAP note sections, which can vary a lot in length. */
export function AutoGrowTextarea({ value, className, ...rest }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={["auto-grow-textarea", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
