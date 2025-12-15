"use client";

import React, { useEffect, useMemo, useState } from "react";
import cityDistrictData from "@/lib/city_district.json";

type LeafDistrict = { name: string; type: string };
type MidDistrict = { name: string; type: string; districts?: LeafDistrict[] };
type Sido = { name: string; type: string; districts: MidDistrict[] };

type CityDistrictJson = {
  updated_at: string;
  schema: unknown;
  sido: Sido[];
};

type Props = {
  valueCity: string; // form.city (시/도)
  valueDistrict: string; // form.district (구/군 또는 "용인시 기흥구")
  onChangeCity: (nextCity: string) => void;
  onChangeDistrict: (nextDistrict: string) => void;
  disabled?: boolean;
  required?: boolean;
  renderError?: (field: "city" | "district") => React.ReactNode;
};

function parseDistrict(valueDistrict: string): { level1: string; level2: string } {
  const trimmed = (valueDistrict || "").trim();
  if (!trimmed) return { level1: "", level2: "" };

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { level1: parts[0], level2: "" };
  return { level1: parts[0], level2: parts.slice(1).join(" ") };
}

export default function RegionSelectKR({
  valueCity,
  valueDistrict,
  onChangeCity,
  onChangeDistrict,
  disabled = false,
  required = true,
  renderError,
}: Props) {
  const data = cityDistrictData as CityDistrictJson;

  const sidoList = useMemo(() => data.sido ?? [], [data.sido]);

  const [selectedLevel1, setSelectedLevel1] = useState<string>("");
  const [selectedLevel2, setSelectedLevel2] = useState<string>("");

  const selectedSidoObj = useMemo(() => {
    return sidoList.find((s) => s.name === valueCity) ?? null;
  }, [sidoList, valueCity]);

  const level1Options = useMemo(() => selectedSidoObj?.districts ?? [], [selectedSidoObj]);

  const selectedLevel1Obj = useMemo(() => {
    return level1Options.find((d) => d.name === selectedLevel1) ?? null;
  }, [level1Options, selectedLevel1]);

  const level2Options = useMemo(() => selectedLevel1Obj?.districts ?? [], [selectedLevel1Obj]);

  const hasLevel2 = level2Options.length > 0;
  const hasLevel1 = level1Options.length > 0;

  // 외부 form 값이 로딩/수정으로 바뀌면 내부 상태 동기화
  useEffect(() => {
    const { level1, level2 } = parseDistrict(valueDistrict);
    setSelectedLevel1(level1);
    setSelectedLevel2(level2);
  }, [valueDistrict, valueCity]);

  const selectClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100";

  const handleCityChange = (nextCity: string) => {
    onChangeCity(nextCity);

    // 시/도 바뀌면 하위 선택 초기화
    setSelectedLevel1("");
    setSelectedLevel2("");

    // (B) 하위 구/군이 없는 시/도(예: 세종)는 district에 시/도 자체를 저장
    const nextSido = sidoList.find((s) => s.name === nextCity);
    const nextHasLevel1 = (nextSido?.districts?.length ?? 0) > 0;

    if (nextCity && !nextHasLevel1) {
      onChangeDistrict(nextCity);
    } else {
      onChangeDistrict("");
    }
  };

  const handleLevel1Change = (nextLevel1: string) => {
    setSelectedLevel1(nextLevel1);
    setSelectedLevel2("");

    // 2단계 케이스: district = "강남구" / "양평군" / "용인시"(일단 여기까지)
    onChangeDistrict(nextLevel1);
  };

  const handleLevel2Change = (nextLevel2: string) => {
    setSelectedLevel2(nextLevel2);
    // 3단계 케이스: district = "용인시 기흥구"
    onChangeDistrict(`${selectedLevel1} ${nextLevel2}`.trim());
  };

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <div>
        <label className="block text-sm font-medium text-slate-800">
          City / 시·도
          {required && <span className="text-rose-500"> *</span>}
        </label>
        <select name="city" value={valueCity} onChange={(e) => handleCityChange(e.target.value)} disabled={disabled} className={selectClass}>
          <option value="">Select / 선택</option>
          {sidoList.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        {renderError?.("city")}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-800">
          District / 시·군·구
          {required && <span className="text-rose-500"> *</span>}
        </label>
        <select
          value={selectedLevel1}
          onChange={(e) => handleLevel1Change(e.target.value)}
          disabled={disabled || !valueCity || !hasLevel1}
          className={selectClass}>
          <option value="">{!valueCity ? "Select city first / 시·도를 먼저 선택" : !hasLevel1 ? "N/A (auto) / 자동 설정" : "Select / 선택"}</option>
          {level1Options.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        {renderError?.("district")}
      </div>

      {hasLevel2 ? (
        <div>
          <label className="block text-sm font-medium text-slate-800">Sub-district / 구{required && <span className="text-rose-500"> *</span>}</label>
          <select
            value={selectedLevel2}
            onChange={(e) => handleLevel2Change(e.target.value)}
            disabled={disabled || !selectedLevel1}
            className={selectClass}>
            <option value="">{selectedLevel1 ? "Select / 선택" : "Select district first / 시·군·구 먼저 선택"}</option>
            {level2Options.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
