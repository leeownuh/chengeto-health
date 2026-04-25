/**
 * CHENGETO Health - Offline Context
 * Manages offline-first functionality with IndexedDB and sync
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const OfflineContext = createContext(null);

const DB_NAME = 'chengeto-offline';
const DB_VERSION = 2;

// Initialize IndexedDB
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store for pending actions (offline mutations)
      if (!db.objectStoreNames.contains('pendingActions')) {
        const pendingStore = db.objectStoreNames.contains('pendingActions') 
          ? db.objectStore('pendingActions')
          : db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
        pendingStore.createIndex('type', 'type', { unique: false });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store for cached patients
      if (!db.objectStoreNames.contains('patients')) {
        db.createObjectStore('patients', { keyPath: '_id' });
      }

      // Store for cached check-ins
      if (!db.objectStoreNames.contains('checkIns')) {
        db.createObjectStore('checkIns', { keyPath: '_id' });
      }

      // Store for cached alerts
      if (!db.objectStoreNames.contains('alerts')) {
        db.createObjectStore('alerts', { keyPath: '_id' });
      }

      // Store for cached schedules
      if (!db.objectStoreNames.contains('schedules')) {
        db.createObjectStore('schedules', { keyPath: '_id' });
      }

      // Store for cached telemetry
      if (!db.objectStoreNames.contains('telemetry')) {
        const telemetryStore = db.createObjectStore('telemetry', { keyPath: 'id', autoIncrement: true });
        telemetryStore.createIndex('patientId', 'patientId', { unique: false });
        telemetryStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    },
  });
};

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [db, setDb] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Initialize database
  useEffect(() => {
    initDB().then((database) => {
      setDb(database);
      loadPendingActions(database);
    }).catch(console.error);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [db]);

  // Load pending actions from IndexedDB
  const loadPendingActions = async (database) => {
    try {
      const actions = await database.getAll('pendingActions');
      setPendingActions(actions);
    } catch (error) {
      console.error('Failed to load pending actions:', error);
    }
  };

  // Queue an action for offline sync
  const queueAction = useCallback(async (action) => {
    if (!db) return null;

    const actionRecord = {
      ...action,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    try {
      const id = await db.add('pendingActions', actionRecord);
      setPendingActions((prev) => [...prev, { ...actionRecord, id }]);
      return id;
    } catch (error) {
      console.error('Failed to queue action:', error);
      return null;
    }
  }, [db]);

  // Remove a pending action
  const removePendingAction = useCallback(async (actionId) => {
    if (!db) return;

    try {
      await db.delete('pendingActions', actionId);
      setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }, [db]);

  // Sync pending actions with server
  const syncPendingActions = useCallback(async () => {
    if (!db || syncInProgress || pendingActions.length === 0) return;

    setSyncInProgress(true);

    for (const action of pendingActions) {
      try {
        // Import api dynamically to avoid circular dependency
        const { api } = await import('./AuthContext');
        
        const response = await api({
          method: action.method,
          url: action.url,
          data: action.data,
        });

        if (response.status >= 200 && response.status < 300) {
          await removePendingAction(action.id);
          
          // Dispatch custom event for successful sync
          window.dispatchEvent(new CustomEvent('action:synced', { 
            detail: { action, response: response.data } 
          }));
        }
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        
        // Update retry count
        if (action.retries >= 3) {
          // Mark as failed after 3 retries
          await db.put('pendingActions', { ...action, status: 'failed' });
        } else {
          await db.put('pendingActions', { ...action, retries: (action.retries || 0) + 1 });
        }
      }
    }

    setSyncInProgress(false);
  }, [db, pendingActions, removePendingAction, syncInProgress]);

  // Cache data for offline access
  const cacheData = useCallback(async (storeName, data) => {
    if (!db) return;

    try {
      if (Array.isArray(data)) {
        const tx = db.transaction(storeName, 'readwrite');
        await Promise.all([
          ...data.map((item) => tx.store.put(item)),
          tx.done,
        ]);
      } else {
        await db.put(storeName, data);
      }
    } catch (error) {
      console.error(`Failed to cache ${storeName}:`, error);
    }
  }, [db]);

  // Get cached data
  const getCachedData = useCallback(async (storeName, key = null) => {
    if (!db) return null;

    try {
      if (key) {
        return await db.get(storeName, key);
      }
      return await db.getAll(storeName);
    } catch (error) {
      console.error(`Failed to get cached ${storeName}:`, error);
      return null;
    }
  }, [db]);

  // Clear cached data
  const clearCache = useCallback(async (storeName = null) => {
    if (!db) return;

    try {
      if (storeName) {
        await db.clear(storeName);
      } else {
        // Clear all stores
        const storeNames = ['patients', 'checkIns', 'alerts', 'schedules', 'telemetry'];
        await Promise.all(storeNames.map((name) => db.clear(name)));
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [db]);

  // Perform action with offline support
  const performAction = useCallback(async (action) => {
    if (isOnline) {
      try {
        const { api } = await import('./AuthContext');
        const response = await api({
          method: action.method,
          url: action.url,
          data: action.data,
        });
        return { success: true, data: response.data, offline: false };
      } catch (error) {
        // If request fails, queue for retry
        await queueAction(action);
        return { success: false, error: error.message, offline: true, queued: true };
      }
    } else {
      // Offline - queue the action
      const actionId = await queueAction(action);
      return { success: true, offline: true, queued: true, actionId };
    }
  }, [isOnline, queueAction]);

  const value = {
    isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    syncInProgress,
    queueAction,
    removePendingAction,
    syncPendingActions,
    cacheData,
    getCachedData,
    clearCache,
    performAction,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export default OfflineContext;
