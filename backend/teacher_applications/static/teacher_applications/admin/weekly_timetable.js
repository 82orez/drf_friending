(function () {
  const DAYS = [
    { key: "MON", label: "Mon / 월" },
    { key: "TUE", label: "Tue / 화" },
    { key: "WED", label: "Wed / 수" },
    { key: "THU", label: "Thu / 목" },
    { key: "FRI", label: "Fri / 금" },
    { key: "SAT", label: "Sat / 토" },
    { key: "SUN", label: "Sun / 일" },
  ];

  const pad2 = (n) => String(n).padStart(2, "0");
  const minutesToLabel = (min) =>
    `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

  function safeParse(text) {
    try {
      const v = JSON.parse(text);
      // ✅ 이중 인코딩/문자열 저장 방어: 결과가 문자열이면 한 번 더
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      }
      return v;
    } catch {
      return null;
    }
  }

  function defaultPayload() {
    return {
      tz: "Asia/Seoul",
      stepMinutes: 30,
      startHour: 6,
      endHour: 24,
      days: { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] },
    };
  }

  function normalize(v) {
    const d = defaultPayload();
    if (!v || typeof v !== "object") return d;

    const days = v.days && typeof v.days === "object" ? v.days : {};
    const startHour = Number.isFinite(v.startHour) ? v.startHour : d.startHour;
    const endHour = Number.isFinite(v.endHour) ? v.endHour : d.endHour;

    return {
      tz: "Asia/Seoul",
      stepMinutes: 30,
      startHour,
      endHour,
      days: {
        MON: Array.isArray(days.MON) ? days.MON : [],
        TUE: Array.isArray(days.TUE) ? days.TUE : [],
        WED: Array.isArray(days.WED) ? days.WED : [],
        THU: Array.isArray(days.THU) ? days.THU : [],
        FRI: Array.isArray(days.FRI) ? days.FRI : [],
        SAT: Array.isArray(days.SAT) ? days.SAT : [],
        SUN: Array.isArray(days.SUN) ? days.SUN : [],
      },
    };
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort((a, b) => a - b);
  }

  function isSelected(payload, day, slotIndex) {
    return (payload.days[day] || []).includes(slotIndex);
  }

  function setSlot(payload, day, slotIndex, on) {
    const prev = new Set(payload.days[day] || []);
    if (on) prev.add(slotIndex);
    else prev.delete(slotIndex);
    payload.days[day] = Array.from(prev).sort((a, b) => a - b);
  }

  function buildSlots(payload) {
    const step = payload.stepMinutes; // 30
    const startMin = payload.startHour * 60;
    const endMin = payload.endHour * 60;
    const slots = [];
    for (let m = startMin; m < endMin; m += step) {
      slots.push(m / step); // slotIndex
    }
    return slots;
  }

  function toRanges(slotIndices, stepMinutes) {
    const sorted = uniqueSorted(slotIndices);
    const ranges = [];
    let i = 0;

    while (i < sorted.length) {
      const start = sorted[i];
      let end = start + 1;
      i++;
      while (i < sorted.length && sorted[i] === end) {
        end++;
        i++;
      }
      ranges.push([start, end]); // end exclusive
    }

    return ranges.map(([s, e]) => {
      const sMin = s * stepMinutes;
      const eMin = e * stepMinutes;
      return `${minutesToLabel(sMin)}-${minutesToLabel(eMin)}`;
    });
  }

  function summarize(payload) {
    const parts = [];
    for (const d of DAYS) {
      const arr = payload.days[d.key] || [];
      if (!arr.length) continue;
      parts.push(
        `${d.label}: ${toRanges(arr, payload.stepMinutes).join(", ")}`,
      );
    }
    return parts.length ? parts.join(" · ") : "Not selected / 선택 안 함";
  }

  function updateHiddenInput(root, payload) {
    const input = root.querySelector('input[type="hidden"]');
    if (!input) return;
    input.value = JSON.stringify(payload);
  }

  function applyPreset(payload, targetDays, fromHour, toHour) {
    const step = payload.stepMinutes; // 30
    const fromSlot = (fromHour * 60) / step;
    const toSlot = (toHour * 60) / step;

    for (const day of targetDays) {
      const set = new Set(payload.days[day] || []);
      for (let s = fromSlot; s < toSlot; s++) set.add(s);
      payload.days[day] = Array.from(set).sort((a, b) => a - b);
    }
  }

  function render(root, payload) {
    const grid = root.querySelector('[data-role="grid"]');
    const summaryEl = root.querySelector('[data-role="summary"]');
    if (!grid) return;

    grid.innerHTML = "";

    const slots = buildSlots(payload);

    // header
    const header = document.createElement("div");
    header.className = "wtt-row wtt-header";
    header.appendChild(cell("Time", "wtt-cell wtt-time wtt-headercell"));
    DAYS.forEach((d) =>
      header.appendChild(cell(d.label, "wtt-cell wtt-day wtt-headercell")),
    );
    grid.appendChild(header);

    // rows
    slots.forEach((slotIndex) => {
      const row = document.createElement("div");
      row.className = "wtt-row";

      const min = slotIndex * payload.stepMinutes;
      row.appendChild(cell(minutesToLabel(min), "wtt-cell wtt-time"));

      DAYS.forEach((d) => {
        const on = isSelected(payload, d.key, slotIndex);

        const c = document.createElement("div");
        c.className = "wtt-cell wtt-slot";
        c.dataset.day = d.key;
        c.dataset.slot = String(slotIndex);

        const pill = document.createElement("div");
        pill.className = "wtt-pill " + (on ? "is-on" : "is-off");
        c.appendChild(pill);

        row.appendChild(c);
      });

      grid.appendChild(row);
    });

    if (summaryEl) summaryEl.textContent = summarize(payload);
  }

  function cell(text, className) {
    const el = document.createElement("div");
    el.className = className || "";
    el.textContent = text;
    return el;
  }

  function initOne(root) {
    const input = root.querySelector('input[type="hidden"]');
    const fromInput = input ? input.value || "" : "";
    const fromAttr = root.getAttribute("data-initial") || "";

    // ✅ input 값을 우선으로 사용
    const initialText = fromInput || fromAttr;

    const parsed = safeParse(initialText);
    const payload = normalize(parsed);

    updateHiddenInput(root, payload);
    render(root, payload);

    // pointer painting
    let painting = false;
    let paintMode = "on"; // "on" | "off"
    let pointerId = null;
    let lastKey = "";

    function handlePointerDown(e) {
      const target = e.target.closest(".wtt-slot");
      if (!target) return;

      e.preventDefault();
      root.setPointerCapture?.(e.pointerId);

      painting = true;
      pointerId = e.pointerId;

      const day = target.dataset.day;
      const slotIndex = Number(target.dataset.slot);
      const currently = isSelected(payload, day, slotIndex);
      paintMode = currently ? "off" : "on";

      setSlot(payload, day, slotIndex, paintMode === "on");
      updateHiddenInput(root, payload);
      render(root, payload);

      lastKey = `${day}-${slotIndex}`;
    }

    function handlePointerMove(e) {
      if (!painting) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el && el.closest ? el.closest(".wtt-slot") : null;
      if (!target) return;

      const day = target.dataset.day;
      const slotIndex = Number(target.dataset.slot);
      const key = `${day}-${slotIndex}`;
      if (key === lastKey) return;
      lastKey = key;

      setSlot(payload, day, slotIndex, paintMode === "on");
      updateHiddenInput(root, payload);
      // 성능 더 필요하면 부분 업데이트로 바꿀 수 있지만, 우선 전체 렌더로 단순 유지
      render(root, payload);
    }

    function stopPaint(e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      painting = false;
      pointerId = null;
      lastKey = "";
      try {
        root.releasePointerCapture?.(e.pointerId);
      } catch {}
    }

    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerup", stopPaint);
    root.addEventListener("pointercancel", stopPaint);

    // toolbar actions
    root
      .querySelector('[data-action="clear"]')
      ?.addEventListener("click", () => {
        // null로 저장하고 싶으면 아래 2줄을 주석/해제해서 선택하세요.
        // payload.days = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
        // updateHiddenInput(root, payload);

        const d = defaultPayload(); // 기본값(빈 선택 포함)
        Object.assign(payload, d);
        updateHiddenInput(root, payload);
        render(root, payload);
      });

    root
      .querySelector('[data-action="preset-weekdays-evening"]')
      ?.addEventListener("click", () => {
        applyPreset(payload, ["MON", "TUE", "WED", "THU", "FRI"], 18, 22);
        updateHiddenInput(root, payload);
        render(root, payload);
      });

    root
      .querySelector('[data-action="preset-weekends-day"]')
      ?.addEventListener("click", () => {
        applyPreset(payload, ["SAT", "SUN"], 10, 18);
        updateHiddenInput(root, payload);
        render(root, payload);
      });

    root
      .querySelector('[data-action="preset-weekdays-morning"]')
      ?.addEventListener("click", () => {
        applyPreset(payload, ["MON", "TUE", "WED", "THU", "FRI"], 9, 12);
        updateHiddenInput(root, payload);
        render(root, payload);
      });
  }

  function initAll() {
    document.querySelectorAll(".weekly-timetable").forEach(initOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
