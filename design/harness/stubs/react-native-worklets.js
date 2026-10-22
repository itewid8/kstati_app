module.exports = { scheduleOnRN: (f, ...a) => f(...a), scheduleOnUI: (f, ...a) => f(...a), runOnJS: (f) => f, runOnUI: (f) => f };
