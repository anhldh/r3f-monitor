/**
 * Đo tần số quét màn hình (Hz) qua nhịp requestAnimationFrame.
 *
 * Không có browser API nào expose refresh rate, nên suy ra từ khoảng cách
 * giữa các frame rAF. Dùng median của các khoảng NGẮN NHẤT thay vì trung
 * bình: dù main thread đang bận (app mount, shader compile), chỉ cần vài
 * cặp frame chạy đúng nhịp là ra chu kỳ màn hình thật; đồng thời median
 * chống outlier jitter (cặp frame dính nhau bất thường).
 *
 * Lưu ý: tab ẩn / tiết kiệm pin làm rAF bị throttle -> số đo thấp hơn thật.
 * Nên kết hợp với nguồn khác (vd max FPS từng thấy) thay vì tin tuyệt đối.
 */
export function detectRefreshRate(samples = 30): Promise<number> {
  return new Promise((resolve) => {
    const skip = 5; // bỏ các frame đầu — rAF mới khởi động hay jitter
    const intervals: number[] = [];
    let last = 0;
    let count = 0;

    const loop = (t: number) => {
      count++;
      if (count > skip && last > 0) intervals.push(t - last);
      last = t;

      if (intervals.length < samples) {
        window.requestAnimationFrame(loop);
        return;
      }

      intervals.sort((a, b) => a - b);
      const k = Math.min(5, intervals.length);
      const median = intervals[Math.floor(k / 2)];
      resolve(median > 0 ? 1000 / median : 60);
    };

    window.requestAnimationFrame(loop);
  });
}
