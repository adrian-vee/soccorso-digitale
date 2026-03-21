import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from '@/lib/query-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

interface ExpiringItem {
  id: number;
  label: string;
  category: string;
  subZone: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  vehicleId?: number;
  vehicleCode?: string;
}

interface NotificationSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  checklistReminderEnabled: boolean;
  checklistReminderTime: string;
  expiryAlertsEnabled: boolean;
  scadenzeReminderEnabled: boolean;
}

async function fetchUserSettings(): Promise<NotificationSettings> {
  const defaults: NotificationSettings = {
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    checklistReminderEnabled: true,
    checklistReminderTime: "07:00",
    expiryAlertsEnabled: true,
    scadenzeReminderEnabled: true,
  };
  try {
    const res = await apiRequest('GET', '/api/user-settings');
    if (res.ok) {
      const data = await res.json();
      return { ...defaults, ...data };
    }
  } catch {}
  return defaults;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('checklist-reminder', {
      name: 'Promemoria Checklist',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('expiry-alerts', {
      name: 'Scadenze Materiali',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF0000',
      sound: 'default',
    });
  }

  return true;
}

export async function fetchExpiringItems(): Promise<ExpiringItem[]> {
  try {
    const response = await apiRequest('GET', '/api/expiry-alerts');
    if (!response.ok) {
      console.log('Expiry alerts API not available or unauthorized');
      return [];
    }
    return await response.json();
  } catch (error) {
    console.log('Could not fetch expiring items (offline or API unavailable)');
    return [];
  }
}

export async function scheduleExpiryNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = await fetchUserSettings();

  if (!settings.notificationsEnabled) {
    console.log('Notifications disabled by user');
    return;
  }

  if (settings.checklistReminderEnabled) {
    const [hours, minutes] = settings.checklistReminderTime.split(':').map(Number);
    const validHour = isNaN(hours) ? 7 : hours;
    const validMinute = isNaN(minutes) ? 0 : minutes;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Promemoria Checklist',
        body: 'Ricordati di compilare la checklist pre-partenza del veicolo',
        data: { type: 'checklist-reminder' },
        sound: settings.soundEnabled ? 'default' : undefined,
        ...(Platform.OS === 'android' ? { channelId: 'checklist-reminder' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: validHour,
        minute: validMinute,
      },
    });
    console.log(`Checklist reminder scheduled at ${validHour}:${String(validMinute).padStart(2, '0')}`);
  }

  if (settings.expiryAlertsEnabled) {
    const expiringItems = await fetchExpiringItems();

    const expiredItems = expiringItems.filter(item => item.daysUntilExpiry <= 0);
    const soonExpiringItems = expiringItems.filter(item => item.daysUntilExpiry > 0 && item.daysUntilExpiry <= 15);

    if (expiredItems.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Materiali Scaduti!',
          body: `${expiredItems.length} articol${expiredItems.length === 1 ? 'o' : 'i'} scadut${expiredItems.length === 1 ? 'o' : 'i'}: ${expiredItems.slice(0, 3).map(i => i.label).join(', ')}${expiredItems.length > 3 ? '...' : ''}`,
          data: { type: 'expiry', expired: true },
          sound: settings.soundEnabled ? 'default' : undefined,
          ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
        },
        trigger: null,
      });
    }

    if (soonExpiringItems.length > 0) {
      const nearestExpiry = Math.min(...soonExpiringItems.map(i => i.daysUntilExpiry));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Materiali in Scadenza',
          body: `${soonExpiringItems.length} articol${soonExpiringItems.length === 1 ? 'o' : 'i'} in scadenza entro ${nearestExpiry} giorn${nearestExpiry === 1 ? 'o' : 'i'}: ${soonExpiringItems.slice(0, 3).map(i => i.label).join(', ')}${soonExpiringItems.length > 3 ? '...' : ''}`,
          data: { type: 'expiry', expired: false },
          sound: settings.soundEnabled ? 'default' : undefined,
          ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
        },
        trigger: null,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Controllo Scadenze',
        body: 'Verifica le scadenze dei materiali in ambulanza',
        data: { type: 'daily-expiry-check' },
        sound: settings.soundEnabled ? 'default' : undefined,
        ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  }

  if (settings.scadenzeReminderEnabled) {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    for (const day of [24, 25]) {
      let targetDate = new Date(currentYear, currentMonth, day, 9, 0, 0);
      if (targetDate <= now) {
        targetDate = new Date(currentYear, currentMonth + 1, day, 9, 0, 0);
      }
      const secondsUntil = Math.max(1, Math.floor((targetDate.getTime() - now.getTime()) / 1000));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Scadenze del Mese',
          body: 'Controlla le scadenze dei materiali per questo mese',
          data: { type: 'monthly-reminder', day },
          sound: settings.soundEnabled ? 'default' : undefined,
          ...(Platform.OS === 'android' ? { channelId: 'expiry-alerts' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil,
        },
      });
    }
  }
}

export async function checkAndNotifyExpiring(): Promise<{ expired: number; expiring: number }> {
  const items = await fetchExpiringItems();
  const expired = items.filter(i => i.daysUntilExpiry <= 0).length;
  const expiring = items.filter(i => i.daysUntilExpiry > 0 && i.daysUntilExpiry <= 15).length;
  
  if (expired > 0 || expiring > 0) {
    await scheduleExpiryNotifications();
  }

  return { expired, expiring };
}
