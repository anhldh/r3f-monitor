// PerfMonitor.tsx
import { type FC } from "react";
import { PerfClassic } from "./PerfClassic";
import { PerfTab } from "./PerfTab";
import type { PerfPropsGui } from "../types";

export const PerfMonitor: FC<PerfPropsGui> = (rawProps) => {
  const props = {
    displayType: "tab" as const,
    showGraph: true,
    graphType: "bar" as const,
    position: "top-right",
    deepAnalyze: false,
    matrixUpdate: false,
    minimal: false,
    antialias: true,
    openByDefault: true,
    overClock: false,
    ...rawProps,
  };

  const { displayType, ...rest } = props;

  return displayType === "tab" ? (
    <PerfTab {...rest} />
  ) : (
    <PerfClassic {...rest} />
  );
};
