"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function DualRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onCommit,
}: {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onCommit: (lo: number, hi: number) => void;
}) {
  const t = useTranslations("shop");
  const fromId = useId();
  const toId = useId();
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  const committed = useRef({ lo: valueMin, hi: valueMax });

  const span = Math.max(max - min, 1);
  const pctMin = ((localMin - min) / span) * 100;
  const pctMax = ((localMax - min) / span) * 100;

  function commit(lo: number, hi: number) {
    if (committed.current.lo === lo && committed.current.hi === hi) return;
    committed.current = { lo, hi };
    onCommit(lo, hi);
  }

  function commitMinBox() {
    const v = Math.min(Math.max(localMin, min), localMax - 1);
    setLocalMin(v);
    commit(v, localMax);
  }

  function commitMaxBox() {
    const v = Math.max(Math.min(localMax, max), localMin + 1);
    setLocalMax(v);
    commit(localMin, v);
  }

  const boxStyle = {
    height: "38px",
    border: "1px solid var(--primitive-light-gray)",
    backgroundColor: "var(--primitive-white)",
  } as const;

  const boxInputStyle = {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--primitive-black)",
  } as const;

  return (
    <div className="flex flex-col">
      <style jsx>{`
        .range {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          pointer-events: none;
        }
        .range::-webkit-slider-runnable-track {
          background: transparent;
          height: 24px;
        }
        .range::-moz-range-track {
          background: transparent;
          height: 24px;
        }
        .range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          box-sizing: border-box;
          width: 16px;
          height: 16px;
          margin-top: 4px;
          border-radius: 50%;
          background: var(--primitive-white);
          border: 2px solid var(--color-action-primary);
          cursor: pointer;
          pointer-events: auto;
        }
        .range::-moz-range-thumb {
          box-sizing: border-box;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--primitive-white);
          border: 2px solid var(--color-action-primary);
          cursor: pointer;
          pointer-events: auto;
        }
      `}</style>

      <div className="relative" style={{ height: "24px" }}>
        <div
          className="absolute"
          style={{
            top: "50%",
            insetInline: 0,
            height: "3px",
            transform: "translateY(-50%)",
            backgroundColor: "var(--primitive-light-gray)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "50%",
            insetInlineStart: `${pctMin}%`,
            insetInlineEnd: `${100 - pctMax}%`,
            height: "3px",
            transform: "translateY(-50%)",
            backgroundColor: "var(--color-action-primary)",
          }}
        />
        <input
          type="range"
          className="range"
          aria-label={t("price_from")}
          min={min}
          max={max}
          step={1}
          value={localMin}
          style={{ zIndex: localMin > (min + max) / 2 ? 5 : 3 }}
          onChange={(e) =>
            setLocalMin(Math.min(Number(e.target.value), localMax - 1))
          }
          onPointerUp={() => commit(localMin, localMax)}
          onKeyUp={() => commit(localMin, localMax)}
          onBlur={() => commit(localMin, localMax)}
        />
        <input
          type="range"
          className="range"
          aria-label={t("price_to")}
          min={min}
          max={max}
          step={1}
          value={localMax}
          style={{ zIndex: 4 }}
          onChange={(e) =>
            setLocalMax(Math.max(Number(e.target.value), localMin + 1))
          }
          onPointerUp={() => commit(localMin, localMax)}
          onKeyUp={() => commit(localMin, localMax)}
          onBlur={() => commit(localMin, localMax)}
        />
      </div>

      <div className="mt-5 flex items-end" style={{ gap: "0.625rem" }}>
        <div className="flex-1 min-w-0">
          <label
            htmlFor={fromId}
            className="mb-1 block text-eyebrow"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("price_from")}
          </label>
          <div className="flex items-center gap-1.5 px-2.5" style={boxStyle}>
            <span
              dir="ltr"
              className="text-body-sm"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              AED
            </span>
            <input
              id={fromId}
              type="number"
              inputMode="numeric"
              min={min}
              max={localMax - 1}
              value={localMin}
              onChange={(e) => setLocalMin(Number(e.target.value))}
              onBlur={commitMinBox}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMinBox();
              }}
              className="w-full min-w-0 text-body-sm tabular-nums outline-none"
              style={boxInputStyle}
            />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="flex items-center"
          style={{ height: "38px", color: "var(--color-content-tertiary)" }}
        >
          –
        </span>
        <div className="flex-1 min-w-0">
          <label
            htmlFor={toId}
            className="mb-1 block text-eyebrow"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("price_to")}
          </label>
          <div className="flex items-center gap-1.5 px-2.5" style={boxStyle}>
            <span
              dir="ltr"
              className="text-body-sm"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              AED
            </span>
            <input
              id={toId}
              type="number"
              inputMode="numeric"
              min={localMin + 1}
              max={max}
              value={localMax}
              onChange={(e) => setLocalMax(Number(e.target.value))}
              onBlur={commitMaxBox}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMaxBox();
              }}
              className="w-full min-w-0 text-body-sm tabular-nums outline-none"
              style={boxInputStyle}
            />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span
          dir="ltr"
          className="text-eyebrow"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          AED {min.toLocaleString()}
        </span>
        <span
          dir="ltr"
          className="text-eyebrow"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          AED {max.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
