import {Platform} from 'react-native';

// For iOS simulator use localhost, for Android emulator use 10.0.2.2
const getBaseUrl = (port: number) => {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${port}`;
};

const getWsUrl = (port: number) => {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `ws://${host}:${port}`;
};

export const config = {
  // API endpoints
  api: {
    auth: getBaseUrl(3001),
    puppies: getBaseUrl(3002),
    expert: getBaseUrl(3003),
  },

  // WebSocket endpoints
  ws: {
    chat: getWsUrl(3004),
  },

  // Pagination
  pagination: {
    defaultLimit: 10,
  },
};
