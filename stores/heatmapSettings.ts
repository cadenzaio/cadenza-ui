import { defineStore } from 'pinia';

export interface RangeSection {
  from: number;
  to: number;
}

export interface HeatmapSetting {
  ranges: RangeSection[];
  scaleToData: boolean;
}

export interface HeatmapSettingsState {
  settings: Record<string, HeatmapSetting>;
}

const STORAGE_KEY = 'cadenza-heatmap-settings';

function loadSettingsFromStorage(): Record<string, HeatmapSetting> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

function saveSettingsToStorage(settings: Record<string, HeatmapSetting>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
}

export const useHeatmapSettingsStore = defineStore('heatmapSettings', {
  state: (): HeatmapSettingsState => ({
    settings: loadSettingsFromStorage(),
  }),
  actions: {
    setSettings(key: string, setting: HeatmapSetting) {
      this.settings[key] = JSON.parse(JSON.stringify(setting));
      saveSettingsToStorage(this.settings);
    },
    getSettings(key: string): HeatmapSetting | undefined {
      return this.settings[key];
    },
  },
});
