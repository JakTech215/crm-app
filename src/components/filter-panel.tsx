"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, ChevronUp, ChevronDown, X } from "lucide-react";

// --- Type definitions ---

export interface SelectOption {
  value: string;
  label: string;
}

export interface SingleSelectFilter {
  type: "single-select";
  key: string;
  label: string;
  options: SelectOption[];
  allLabel?: string;
}

export interface MultiSelectFilter {
  type: "multi-select";
  key: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
}

export interface DateRangeFilter {
  type: "date-range";
  keyFrom: string;
  keyTo: string;
  labelFrom?: string;
  labelTo?: string;
}

export type FilterDef = SingleSelectFilter | MultiSelectFilter | DateRangeFilter;

export type FilterValues = Record<string, string | string[]>;

export interface FilterPanelProps {
  filters: FilterDef[];
  values: FilterValues;
  onChange: (key: string, value: string | string[]) => void;
  onClear: () => void;
}

// --- Helper: parse URL params into initial FilterValues ---

export function parseFilterParams(
  filters: FilterDef[],
  searchParams: URLSearchParams
): FilterValues {
  const values: FilterValues = {};
  for (const f of filters) {
    if (f.type === "single-select") {
      values[f.key] = searchParams.get(f.key) || "all";
    } else if (f.type === "multi-select") {
      const raw = searchParams.get(f.key);
      values[f.key] = raw ? raw.split(",") : [];
    } else if (f.type === "date-range") {
      values[f.keyFrom] = searchParams.get(f.keyFrom) || "";
      values[f.keyTo] = searchParams.get(f.keyTo) || "";
    }
  }
  return values;
}

// --- Helper: build default (empty) FilterValues ---

export function defaultFilterValues(filters: FilterDef[]): FilterValues {
  const values: FilterValues = {};
  for (const f of filters) {
    if (f.type === "single-select") {
      values[f.key] = "all";
    } else if (f.type === "multi-select") {
      values[f.key] = [];
    } else if (f.type === "date-range") {
      values[f.keyFrom] = "";
      values[f.keyTo] = "";
    }
  }
  return values;
}

// --- Main component ---

export function FilterPanel({ filters, values, onChange, onClear }: FilterPanelProps) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get("filters") === "open");

  // Count active filters
  const activeCount = useMemo(() => {
    let count = 0;
    for (const f of filters) {
      if (f.type === "single-select") {
        if (values[f.key] && values[f.key] !== "all") count++;
      } else if (f.type === "multi-select") {
        const v = values[f.key];
        if (Array.isArray(v) && v.length > 0) count++;
      } else if (f.type === "date-range") {
        if (values[f.keyFrom]) count++;
        if (values[f.keyTo]) count++;
      }
    }
    return count;
  }, [filters, values]);

  // Build chips for active filters
  const chips = useMemo(() => {
    const result: { id: string; label: string; resetKey: string; resetValue: string | string[] }[] = [];
    for (const f of filters) {
      if (f.type === "single-select") {
        const v = values[f.key];
        if (typeof v === "string" && v !== "all") {
          const opt = f.options.find((o) => o.value === v);
          result.push({
            id: f.key,
            label: `${f.label}: ${opt?.label || v}`,
            resetKey: f.key,
            resetValue: "all",
          });
        }
      } else if (f.type === "multi-select") {
        const v = values[f.key];
        if (Array.isArray(v) && v.length > 0) {
          const labels = v.map((id) => f.options.find((o) => o.value === id)?.label || id);
          result.push({
            id: f.key,
            label: `${f.label}: ${labels.join(", ")}`,
            resetKey: f.key,
            resetValue: [],
          });
        }
      } else if (f.type === "date-range") {
        if (values[f.keyFrom]) {
          result.push({
            id: f.keyFrom,
            label: `${f.labelFrom || "From"}: ${values[f.keyFrom]}`,
            resetKey: f.keyFrom,
            resetValue: "",
          });
        }
        if (values[f.keyTo]) {
          result.push({
            id: f.keyTo,
            label: `${f.labelTo || "To"}: ${values[f.keyTo]}`,
            resetKey: f.keyTo,
            resetValue: "",
          });
        }
      }
    }
    return result;
  }, [filters, values]);

  // Sync filter state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (open) params.set("filters", "open");
    for (const f of filters) {
      if (f.type === "single-select") {
        const v = values[f.key];
        if (typeof v === "string" && v !== "all") params.set(f.key, v);
      } else if (f.type === "multi-select") {
        const v = values[f.key];
        if (Array.isArray(v) && v.length > 0) params.set(f.key, v.join(","));
      } else if (f.type === "date-range") {
        const from = values[f.keyFrom];
        const to = values[f.keyTo];
        if (typeof from === "string" && from) params.set(f.keyFrom, from);
        if (typeof to === "string" && to) params.set(f.keyTo, to);
      }
    }
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [open, filters, values]);

  return (
    <div className="space-y-2">
      {/* Toggle row */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full px-2 py-0 text-xs">
              {activeCount}
            </Badge>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        {activeCount > 0 && !open && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded filter panel */}
      {open && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map((f) => {
                if (f.type === "single-select") {
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Select
                        value={(values[f.key] as string) || "all"}
                        onValueChange={(v) => onChange(f.key, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{f.allLabel || "All"}</SelectItem>
                          {f.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (f.type === "multi-select") {
                  const selected = (Array.isArray(values[f.key]) ? values[f.key] : []) as string[];
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start h-9 font-normal"
                          >
                            {selected.length > 0
                              ? `${selected.length} selected`
                              : f.placeholder || `All ${f.label}`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {f.options.map((opt) => (
                              <label
                                key={opt.value}
                                className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={selected.includes(opt.value)}
                                  onCheckedChange={() => {
                                    const next = selected.includes(opt.value)
                                      ? selected.filter((v) => v !== opt.value)
                                      : [...selected, opt.value];
                                    onChange(f.key, next);
                                  }}
                                />
                                <span className="text-sm">{opt.label}</span>
                              </label>
                            ))}
                            {f.options.length === 0 && (
                              <p className="text-sm text-muted-foreground p-2">No options</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                }

                if (f.type === "date-range") {
                  return (
                    <div key={`${f.keyFrom}-${f.keyTo}`} className="space-y-1 col-span-2 md:col-span-1 lg:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        {f.labelFrom && f.labelTo ? `${f.labelFrom} / ${f.labelTo}` : "Date Range"}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          className="h-9"
                          value={(values[f.keyFrom] as string) || ""}
                          onChange={(e) => onChange(f.keyFrom, e.target.value)}
                        />
                        <span className="flex items-center text-sm text-muted-foreground">to</span>
                        <Input
                          type="date"
                          className="h-9"
                          value={(values[f.keyTo] as string) || ""}
                          onChange={(e) => onChange(f.keyTo, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
            {activeCount > 0 && (
              <div className="flex justify-end mt-3">
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active filter chips when collapsed */}
      {!open && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button
                onClick={() => onChange(chip.resetKey, chip.resetValue)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
