import type { HTMLAttributes } from "react";

export type chart = {
  length: number;
  hz: number;
};

export interface PerfProps {
  /** Names this canvas for hooks outside it: `usePerfData({ id })`. */
  id?: string;
  logsPerSecond?: number;
  matrixUpdate?: boolean;
  chart?: chart;
  deepAnalyze?: boolean;
}

export interface PerfPropsGui extends PerfProps {
  showGraph?: boolean;
  displayType?: "tab" | "classic";
  graphType?: "line" | "bar";
  antialias?: boolean;
  openByDefault?: boolean;
  position?: string;
  minimal?: boolean;
  className?: string;
  style?: object;
  perfContainerRef?: any;
}

export interface PerfUIProps extends HTMLAttributes<HTMLDivElement> {
  perfContainerRef?: any;
  showGraph?: boolean;
  antialias?: boolean;
  chart?: chart;
  minimal?: boolean;
  matrixUpdate?: boolean;
}
