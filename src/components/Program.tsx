import { type FC, useEffect, useState } from "react";
import { usePerf, type ProgramsPerf } from "../store";
import type { PerfProps } from "../types";
import { estimateBytesUsed } from "../helpers/estimateBytesUsed";
import s from "../style/program.module.css";

// --- HELPERS ---

const addTextureUniforms = (id: string, texture: any) => {
  const repeatType = (wrap: number) => {
    switch (wrap) {
      case 1000:
        return "RepeatWrapping";
      case 1001:
        return "ClampToEdgeWrapping";
      case 1002:
        return "MirroredRepeatWrapping";
      default:
        return "ClampToEdgeWrapping";
    }
  };

  const encodingType = (encoding: number) => {
    switch (encoding) {
      case 3000:
        return "LinearEncoding";
      case 3001:
        return "sRGBEncoding";
      case 3002:
        return "RGBEEncoding";
      case 3003:
        return "LogLuvEncoding";
      case 3004:
        return "RGBM7Encoding";
      case 3005:
        return "RGBM16Encoding";
      case 3006:
        return "RGBDEncoding";
      case 3007:
        return "GammaEncoding";
      default:
        return "ClampToEdgeWrapping";
    }
  };

  return {
    name: id,
    url: texture?.image?.currentSrc,
    encoding: encodingType(texture.encoding),
    wrapT: repeatType(texture.wrapT),
    flipY: texture.flipY?.toString(),
  };
};

// --- SUB-COMPONENTS ---

const MetricBadge = ({
  value,
  label,
  unit,
  title,
}: {
  value: string | number;
  label?: string;
  unit?: string;
  title?: string;
}) => {
  if (value === undefined || value === null || value === 0 || value === "0")
    return null;
  return (
    <div className={s.metricBadge} title={title}>
      <b>{value}</b> {unit || label}
    </div>
  );
};

const UniformsGL = ({ program, material, setTexNumber }: any) => {
  const gl = usePerf((state) => state.gl);
  const [uniforms, set] = useState<any | null>(null);

  useEffect(() => {
    if (gl) {
      const data: any = program?.getUniforms();
      let TexCount = 0;
      const format: any = new Map();

      if (data && data.seq) {
        data.seq.forEach((e: any) => {
          if (
            !e.id.includes("uTroika") &&
            ![
              "isOrthographic",
              "uvTransform",
              "lightProbe",
              "projectionMatrix",
              "viewMatrix",
              "normalMatrix",
              "modelMatrix",
              "modelViewMatrix",
            ].includes(e.id)
          ) {
            const values: any = [];
            const data: any = { name: e.id };
            if (e.cache) {
              e.cache.forEach((v: any) => {
                if (typeof v !== "undefined")
                  values.push(v.toString().substring(0, 4));
              });
              data.value = values.join();
              if (material[e.id] && material[e.id].image) {
                TexCount++;
                data.value = addTextureUniforms(e.id, material[e.id]);
              }
              if (!data.value) data.value = "empty";
              format.set(e.id, data);
            }
          }
        });
      }

      if (material.uniforms) {
        Object.keys(material.uniforms).forEach((key: any) => {
          const uniform = material.uniforms[key];
          if (uniform.value) {
            const { value } = uniform;
            const data: any = { name: key };
            if (key.includes("uTroika")) return;
            if (value.isTexture) {
              TexCount++;
              data.value = addTextureUniforms(key, value);
            } else {
              let sb = JSON.stringify(value);
              try {
                sb = JSON.stringify(value);
              } catch {
                sb = value.toString();
              }
              data.value = sb;
            }
            format.set(key, data);
          }
        });
      }

      // WebGPU: no program uniforms — list texture slots straight off the material.
      if (!program) {
        Object.keys(material).forEach((key) => {
          const value = material[key];
          if (value && value.isTexture && !format.has(key)) {
            TexCount++;
            format.set(key, {
              name: key,
              value: addTextureUniforms(key, value),
            });
          }
        });
      }

      setTexNumber(TexCount);
      set(format);
    }
  }, [gl, material, program, setTexNumber]);

  return (
    <ul className={s.programsUL}>
      {uniforms &&
        Array.from(uniforms.values()).map((uniform: any) => (
          <span key={uniform.name}>
            {typeof uniform.value === "string" ? (
              <li>
                <span>
                  {uniform.name} :{" "}
                  <b>
                    {uniform.value.substring(0, 30)}
                    {uniform.value.length > 30 ? "..." : ""}
                  </b>
                </span>
              </li>
            ) : (
              <>
                <li>
                  <b>{uniform.value.name}:</b>
                </li>
                <div>
                  {Object.keys(uniform.value).map((key) =>
                    key !== "name" ? (
                      <div key={key}>
                        {key === "url" ? (
                          <a
                            href={uniform.value[key]}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={uniform.value[key]} alt="texture" />
                          </a>
                        ) : (
                          <li>
                            {key}: <b>{uniform.value[key]}</b>
                          </li>
                        )}
                      </div>
                    ) : null,
                  )}
                  <button
                    className={s.programConsole}
                    onClick={() => {
                      console.info(
                        material[uniform.value.name] ||
                          material?.uniforms[uniform.value.name]?.value,
                      );
                    }}
                  >
                    console.info({uniform.value.name});
                  </button>
                </div>
              </>
            )}
          </span>
        ))}
    </ul>
  );
};

// --- MAIN UI COMPONENT ---

const ProgramUI: FC<{ el: ProgramsPerf }> = ({ el }) => {
  const [showProgram, setShowProgram] = useState(el.visible);
  const [toggleProgram, set] = useState(el.expand);
  const [texNumber, setTexNumber] = useState(0);
  const { meshes, program, material }: any = el;

  // Lấy GL context để tính % render
  const gl: any = usePerf((state) => state.gl);
  // This canvas only: a bare invalidate() would wake every demand canvas
  const invalidate = usePerf((state) => state.invalidate);

  // Helper tính % Draw Calls
  const getDrawCallPercent = () => {
    if (!gl || !gl.info || !gl.info.render) return 0;
    const total =
      gl.info.render.triangles + gl.info.render.lines + gl.info.render.points;
    if (total === 0) return 0;
    const res = Math.round((el.drawCounts.total / total) * 100 * 10) / 10;
    return (isFinite(res) && res) || 0;
  };

  const meshCount = Object.keys(meshes).length;
  const drawPercent = getDrawCallPercent();

  return (
    <div className={s.programGeo}>
      {/* --- HEADER --- */}
      <div
        className={s.programHeader}
        onClick={() => {
          // Khi click header thì toggle expand, đồng thời tắt wireframe
          Object.keys(meshes).forEach((key) => {
            meshes[key].material.wireframe = false;
          });
          invalidate(); // imperative change: frameloop="demand" needs a frame
          set(!toggleProgram);
        }}
      >
        {/* LEFT: Arrow + Name */}
        <div className={s.headerLeft}>
          <div
            className={s.toggleArrow}
            style={{
              transform: toggleProgram ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </div>
          <span className={s.programTitle}>
            {program ? program.name : material.name || material.type}
          </span>
        </div>

        {/* RIGHT: Metrics + Actions */}
        <div className={s.headerRight}>
          {/* 1. Users (Mesh Count) */}
          <MetricBadge
            value={meshCount}
            unit={meshCount > 1 ? "users" : "user"}
          />

          {/* 2. Texture Count */}
          <MetricBadge value={texNumber} unit="tex" />

          {/* 3. Draw Counts (Triangles/Points/Lines) */}
          {el.drawCounts.total > 0 && (
            <div
              className={s.metricBadge}
              title={`${drawPercent}% of total render`}
            >
              <b>{el.drawCounts.total}</b>
              {el.drawCounts.type === "Triangle" ? "tris" : el.drawCounts.type}
              {el.visible && !(el.material as any).wireframe && (
                <span
                  style={{ marginLeft: "4px", opacity: 0.6, fontSize: "9px" }}
                >
                  ({drawPercent}%)
                </span>
              )}
            </div>
          )}

          {/* 4. GLSL Version */}
          {material.glslVersion === "300 es" && (
            <MetricBadge value="300" unit="es" />
          )}

          {/* 5. Visibility Toggle (Eye) */}
          <div
            className={`${s.visibilityBtn} ${showProgram ? s.active : ""}`}
            // Hover: Show Wireframe
            onPointerEnter={() => {
              Object.keys(meshes).forEach(
                (key) => (meshes[key].material.wireframe = true),
              );
              invalidate();
            }}
            onPointerLeave={() => {
              Object.keys(meshes).forEach(
                (key) => (meshes[key].material.wireframe = false),
              );
              invalidate();
            }}
            // Click: Toggle Visibility
            onClick={(e) => {
              e.stopPropagation();
              const invert = !showProgram;

              // 1. Update THREE.js objects directly
              Object.keys(meshes).forEach((key) => {
                if (meshes[key]) meshes[key].visible = invert;
              });
              invalidate();
              setShowProgram(invert);
            }}
          >
            {showProgram ? "👁" : "×"}
          </div>
        </div>
      </div>

      {/* --- BODY (Collapsed) --- */}
      <div style={{ display: toggleProgram ? "block" : "none" }}>
        {/* UNIFORMS SECTION */}
        <div className={s.programsULHeader} style={{ marginTop: "4px" }}>
          Uniforms
        </div>
        <UniformsGL
          program={program}
          material={material}
          setTexNumber={setTexNumber}
        />

        {/* GEOMETRIES SECTION */}
        <div className={s.programsULHeader}>Geometries</div>
        <ul className={s.programsUL}>
          {meshes &&
            Object.keys(meshes).map(
              (key) =>
                meshes[key] &&
                meshes[key].geometry && (
                  <li key={key} className={s.programsGeoLi}>
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{meshes[key].geometry.type}</span>
                      {meshes[key].userData &&
                        meshes[key].userData.drawCount && (
                          <span
                            style={{
                              color: "#aaa",
                              fontSize: "10px",
                              display: "flex",
                              gap: "6px",
                            }}
                          >
                            <span>
                              <b>{meshes[key].userData.drawCount.count}</b>{" "}
                              {meshes[key].userData.drawCount.type}s
                            </span>
                            <span style={{ opacity: 0.3 }}>|</span>
                            <span>
                              <b>
                                {Math.round(
                                  (estimateBytesUsed(meshes[key].geometry) /
                                    1024) *
                                    100,
                                ) / 100}
                              </b>{" "}
                              KB
                            </span>
                          </span>
                        )}
                    </div>
                  </li>
                ),
            )}
        </ul>

        {/* CONSOLE LOG BTN */}
        <button
          className={s.programConsole}
          onClick={() => console.info(material)}
        >
          Log Material ({material.type})
        </button>
      </div>
    </div>
  );
};

/** Per-pass timings — WebGPU with `renderer.inspector` (three r181+) only. */
const PassesUI = () => {
  const passes = usePerf((state) => state.passes);
  if (!passes || passes.length === 0) return null;

  return (
    <div className={s.programGeo}>
      <div className={s.programsULHeader}>Passes</div>
      <ul className={s.programsUL}>
        {passes.map((pass, i) => (
          <li
            key={i}
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <span>
              {pass.type === "compute" ? "compute: " : ""}
              {pass.name}
            </span>
            <span>
              cpu <b>{pass.cpu.toFixed(2)}</b> ms
              {pass.gpu !== null && (
                <>
                  {" "}
                  · gpu <b>{pass.gpu.toFixed(2)}</b> ms
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ProgramsUI: FC<PerfProps> = () => {
  usePerf((state) => state.triggerProgramsUpdate);
  const programs: any = usePerf((state) => state.programs);

  return (
    <div className={s.programsContainer} onWheel={(e) => e.stopPropagation()}>
      <PassesUI />
      {programs &&
        Array.from(programs.values()).map((el: any) => {
          if (!el) return null;
          return <ProgramUI key={el.material.uuid} el={el} />;
        })}
    </div>
  );
};
