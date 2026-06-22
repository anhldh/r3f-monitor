import { usePerf } from "../store";

/**
 * Toàn bộ số liệu hiệu năng đã throttle, sẵn sàng để render UI.
 * - fps/cpu/gpu/mem/vram: số "nóng", đổi theo `logsPerSecond` (~10 lần/giây).
 * - gl: thống kê render của frame gần nhất.
 * - infos: thông tin renderer (đứng yên cả phiên).
 */
export type PerfData = {
  fps: number;
  cpu: number;
  gpu: number;
  mem: number;
  vram: number;
  gl: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number;
  };
  infos: {
    version: string;
    renderer: string;
    vendor: string;
  };
};

/** Gom state thô của store thành PerfData phẳng. */
const select = (s: import("../store").State): PerfData => ({
  fps: s.log?.fps ?? 0,
  cpu: s.log?.cpu ?? 0,
  gpu: s.log?.gpu ?? 0,
  mem: s.log?.mem ?? 0,
  vram: s.estimatedMemory.vram,
  gl: {
    calls: s.gl?.info.render.calls ?? 0,
    triangles: s.gl?.info.render.triangles ?? 0,
    points: s.gl?.info.render.points ?? 0,
    lines: s.gl?.info.render.lines ?? 0,
    geometries: s.gl?.info.memory.geometries ?? 0,
    textures: s.gl?.info.memory.textures ?? 0,
    programs: s.gl?.info.programs?.length ?? 0,
  },
  infos: s.infos ?? { version: "", renderer: "", vendor: "" },
});

/**
 * Hook đọc số liệu hiệu năng để tự dựng UI ("bring your own UI").
 *
 * Cần render <PerfHeadless /> bên trong <Canvas> để có dữ liệu. Update theo
 * nhịp `logsPerSecond` của PerfHeadless, không re-render mỗi frame.
 *
 * @example
 * // Lấy tất cả
 * const { fps, gpu, gl, infos } = usePerfData();
 *
 * @example
 * // Chỉ lấy field cần → chỉ re-render khi field đó đổi
 * const fps = usePerfData((d) => d.fps);
 */
export function usePerfData(): PerfData;
export function usePerfData<T>(selector: (data: PerfData) => T): T;
export function usePerfData<T>(selector?: (data: PerfData) => T) {
  return usePerf((s) => {
    const data = select(s);
    return selector ? selector(data) : data;
  });
}
