import React, {createContext, useContext, useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeightUnit = 'kg' | 'lbs';

interface Settings {
  weightUnit: WeightUnit;
}

interface SettingsContextType {
  settings: Settings;
  setWeightUnit: (unit: WeightUnit) => void;
}

const defaultSettings: Settings = {
  weightUnit: 'lbs',
};

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_KEY = '@puppy_store_settings';

export function SettingsProvider({children}: {children: React.ReactNode}) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(stored => {
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    });
  }, []);

  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const setWeightUnit = (unit: WeightUnit) => {
    saveSettings({...settings, weightUnit: unit});
  };

  return (
    <SettingsContext.Provider value={{settings, setWeightUnit}}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
