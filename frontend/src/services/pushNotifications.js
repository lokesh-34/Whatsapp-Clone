/**
 * Push notifications — disabled (Firebase messaging not configured).
 * Complete no-op stub: prevents all service-worker registration attempts.
 */
export const setupPushNotifications = async () => {
  return { enabled: false, reason: 'not-configured' }
}

export const initPushNotifications  = setupPushNotifications
export const onForegroundMessage    = (_cb) => () => {}