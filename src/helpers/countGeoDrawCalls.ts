import type { drawCounts, ProgramsPerfs } from "../store";

export const countGeoDrawCalls = (programs: ProgramsPerfs) => {
  programs.forEach((program) => {
    const { meshes } = program;
    if (!meshes) {
      return;
    }

    const drawCounts: drawCounts = {
      total: 0,
      type: "Triangle",
      data: [],
    };
    // Type của mesh có drawCount lớn nhất sẽ đại diện cho program
    let mostDrawCalls = 0;

    Object.keys(meshes).forEach((key) => {
      const mesh: any = meshes[key];
      const { geometry, material } = mesh;

      const index = geometry.index;
      const position = geometry.attributes.position;

      if (!position) return;

      const rangeFactor = material.wireframe === true ? 0 : 1;

      const dataCount = index !== null ? index.count : position.count;
      const rangeStart = geometry.drawRange.start * rangeFactor;
      const rangeCount = geometry.drawRange.count * rangeFactor;
      const drawStart = rangeStart;
      const drawEnd = Math.min(dataCount, rangeStart + rangeCount) - 1;

      const instanceCount = mesh.count || 1;
      let countInstanceRatio = 1;
      let type = "Triangle";

      if (mesh.isMesh) {
        if (material.wireframe === true) {
          type = "Line";
          countInstanceRatio /= 2;
        } else {
          type = "Triangle";
          countInstanceRatio /= 3;
        }
      } else if (mesh.isLine) {
        type = "Line";
        if (mesh.isLineSegments) {
          countInstanceRatio /= 2;
        } else if (mesh.isLineLoop) {
          // LineLoop: mỗi vertex tạo 1 segment (khép vòng) — ratio giữ nguyên 1
        } else {
          // Line: n vertex → n-1 segments (giữ nguyên công thức từ bản gốc)
          countInstanceRatio -= 1;
        }
      } else if (mesh.isPoints) {
        // Points: mỗi vertex 1 point — ratio giữ nguyên 1
        type = "Point";
      } else if (mesh.isSprite) {
        type = "Triangle";
        countInstanceRatio /= 3;
      }

      const drawCount = Math.round(
        Math.max(0, drawEnd - drawStart + 1) *
          (countInstanceRatio * instanceCount),
      );

      if (drawCount > mostDrawCalls) {
        mostDrawCalls = drawCount;
        drawCounts.type = type;
      }
      drawCounts.total += drawCount;
      drawCounts.data.push({ drawCount, type });
      mesh.userData.drawCount = {
        type,
        count: drawCount,
      };
    });

    program.drawCounts = drawCounts;
  });
};
