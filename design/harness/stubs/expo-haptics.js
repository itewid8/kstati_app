const noop = async () => {};
module.exports = {
  impactAsync: noop, notificationAsync: noop, selectionAsync: noop, performAndroidHapticsAsync: noop,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: new Proxy({}, { get: (_, k) => String(k) }),
};
